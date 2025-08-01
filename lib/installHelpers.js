var _ = require('underscore');
var async = require('async');
var chalk = require('chalk');
var configuration = require('./configuration');
var database = require('./database');
var exec = require('child_process').exec;
var fs = require('fs-extra');
var inquirer = require('inquirer');
var logger = require('./logger');
var logUpdate = require('log-update');
var mailer = require('./mailer');
var path = require('path');
var readline = require('readline');
var request = require('request');
var semver = require('semver');
var migrateMongoose = require('migrate-mongoose');

var pkg = fs.readJSONSync(path.join(__dirname, '..', 'package.json'));

var DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36';
var DEFAULT_GITHUB_ORG = 'adaptlearning'; // used to pull releases from
var DEFAULT_SERVER_REPO = `https://github.com/${DEFAULT_GITHUB_ORG}/adapt_authoring.git`;
var DEFAULT_FRAMEWORK_REPO = `https://github.com/${DEFAULT_GITHUB_ORG}/adapt_framework.git`;
var REMOTE_NAME = 'origin';

var spinnerInt = -1;

var inputHelpers = {
  passwordReplace: '*',
  numberValidator: v => /^[0-9]*$/.test(v),
  alphanumValidator: v => /^[\w-]*$/.test(v),
  requiredValidator: v => v !== '',
  toBoolean: function(v) {
    if (typeof v === 'boolean') return v;
    if (/(Y|y)[es]*/.test(v)) return true;
    return false;
  },
  isFalsy: function(v) {
    if (typeof v !== 'string') return !v;
    switch (v.trim()) {
      case '':
      case 'N':
      case 'n':
      case 'false':
      case 'null':
      case 'undefined':
      case '0':
        return true;
      default:
        return false;
    }
  }
};

var exports = module.exports = {
  DEFAULT_SERVER_REPO,
  DEFAULT_FRAMEWORK_REPO,
  exit,
  showSpinner,
  hideSpinner,
  getInput,
  inputHelpers,
  checkNodeVersion,
  checkAllDependencies,
  checkPrimaryDependencies,
  checkSecondaryDependencies,
  getInstalledServerVersion,
  getLatestServerVersion,
  getInstalledFrameworkVersion,
  getLatestFrameworkVersion,
  getInstalledVersions,
  getLatestVersions,
  getUpdateData,
  getMigrationConfig,
  syncMigrations,
  installFramework,
  updateFramework,
  cloneRepo,
  updateFrameworkPlugins,
  updateAuthoring,
  buildAuthoring
};

function exit(code, msg, preCallback) {
  var _exit = function() {
    hideSpinner();
    code = code || 0;
    msg = `\n${msg || 'Bye!'}\n`;
    (code === 0) ? ok(msg) : error(msg);
    process.exit(code);
  }
  if(preCallback) {
    preCallback(_exit);
  } else {
    _exit();
  }
}

function showSpinner(text) {
  if(isSilent()) return;
  // NOTE we stop the existing spinner (not ideal)
  hideSpinner();
  var frames = ['-', '\\', '|', '/'];
  var i = 0;
  spinnerInt = setInterval(function() {
    var frame = frames[i = ++i % frames.length];
    logUpdate(`${frame} ${text}`);
  }, 120);
}

function hideSpinner() {
  if(isSilent()) return;
  clearInterval(spinnerInt);
  logUpdate.clear();
}

function getInput(questions, overrides, callback) {
  const prefilled = {};
  // only show question if no prefilled config
  questions = questions.filter(({ name }) => {
    const override = overrides[name];
    if (override === undefined) return true;
    prefilled[name] = override;
  });
  if (!questions.length) {
    return callback(prefilled);
  }
  inquirer.prompt(questions).then(answers => callback({ ...answers, ...prefilled }));
}

function checkAllDependencies(callback) {
  async.parallel(async.reflectAll([
    checkPrimaryDependencies,
    checkSecondaryDependencies
  ]), (error, results) => {
    const errors = results.map(result => result.error).filter(Boolean);
    // all errors will be the same
    callback(errors.length ? errors[0] : null);
  });
}

function checkPrimaryDependencies(callback) {
  checkDependencies([
    checkNodeVersion,
    checkGitInstalled,
    checkGruntCliInstalled,
    checkGithubConnection
  ], callback);
}
function checkSecondaryDependencies(callback) {
  checkDependencies([
    checkDbConnection,
    checkSmtpConnection
  ], callback);
}

/**
* Manually collect all missing prerequisites
* Therefore we do not pass error to async-callbacks as this would exit the process
*/
function checkDependencies(checks, callback) {
  let hasErrored = false;
  async.each(checks, function(check, cb) {
    check.call(this, function(error, warning) {
      if(error)  {
        logger.log('error', error);
        hasErrored = true;
      }
      if(warning) {
        logger.log('warn', warning);
      }
      cb();
    });
  }, err => {
    callback(hasErrored ? new Error('Some of the prerequisites could not be found, see above for details.') : null);
  });
}

function checkNodeVersion(callback) {
  const requiredVersion = pkg.engines.node;
  const installedVersion = process.versions.node;
  if(!semver.satisfies(installedVersion, requiredVersion)) {
    return callback(null, chalk.yellow(`You are using Node.js ${installedVersion} which is not supported by Adapt. If you encounter issues, please change to version ${requiredVersion}.`));
  }
  callback();
}

function checkGitInstalled(callback) {
  execCommand('git --version', {}, error => {
    callback(error ? 'git could not be found, please check it is installed' : null);
  });
}

function checkGruntCliInstalled(callback) {
  execCommand('node ./node_modules/grunt-cli/bin/grunt --version', {}, error => {
    callback(error ? 'grunt-cli could not be found, please check it is installed (run npm install)' : null);
  });
}

function checkGithubConnection(callback) {
  const url = 'https://api.github.com/';
  request({
    headers: { 'User-Agent': DEFAULT_USER_AGENT },
    uri: url,
    method: 'GET'
  }, error => {
    callback(error ? `Failed to connect to ${url}` : null);
  });
}

function checkDbConnection(callback) {
  database.checkConnection(error => {
    callback(error ? `Couldn't connect to the database, please check the connection details are valid` : null);
  });
}

function checkSmtpConnection(callback) {
  if(!configuration.getConfig('useSmtp')) {
    return callback();
  }
  (new mailer()).testConnection(error => callback(null, error && error.message || null));
}

function getInstalledServerVersion(callback) {
  fs.readJSON('package.json', (error, pkg) => {
    if(error) {
      return callback(new Error(`Cannot determine authoring tool version\n${error}`));
    }
    callback(null, pkg.version);
  });
}

function getLatestServerVersion(callback) {
  checkLatestAdaptRepoVersion('adapt_authoring', callback);
}

function getInstalledFrameworkVersion(callback) {
  fs.readJSON(path.join(getFrameworkRoot(), 'package.json'), (error, pkg) => {
    if(error) {
      return callback(new Error(`Cannot determine framework version\n${error}`));
    }
    callback(null, pkg.version);
  });
}

function getLatestFrameworkVersion(installedVersion, callback) {
  let versionLimit;
  if (typeof installedVersion === 'function') {
    callback = installedVersion;
  } else {
    versionLimit = semver.major(installedVersion).toString();
  }
  checkLatestAdaptRepoVersion('adapt_framework', versionLimit, callback);
}

function getInstalledVersions(callback) {
  async.parallel([
    exports.getInstalledServerVersion,
    exports.getInstalledFrameworkVersion
  ], function(error, results) {
    callback(error, {
      adapt_authoring: results[0],
      adapt_framework: results[1]
    });
  });
}

function getLatestVersions(installedVersions, callback) {
  async.parallel([
    exports.getLatestServerVersion,
    async.apply(exports.getLatestFrameworkVersion, installedVersions.adapt_framework)
  ], function(error, results) {
    callback(error, [
      installedVersions,
      { adapt_authoring: results[0], adapt_framework: results[1] }
    ]);
  });
}

function getUpdateData(callback) {
  async.waterfall([
    exports.getInstalledVersions,
    exports.getLatestVersions
  ], function(error, results) {
    if(error) {
      return callback(error);
    }
    var updateData = {};
    if(results[1].adapt_authoring && semver.lt(results[0].adapt_authoring, results[1].adapt_authoring)) {
      updateData.adapt_authoring = results[1].adapt_authoring;
    }
    if(results[1].adapt_framework && semver.lt(results[0].adapt_framework, results[1].adapt_framework)) {
      updateData.adapt_framework = results[1].adapt_framework;
    }
    if(_.isEmpty(updateData)) {
      return callback();
    }
    callback(null, updateData);
  });
}

function getFrameworkRoot() {
  return path.join(configuration.serverRoot, 'temp', configuration.getConfig('masterTenantID'), 'adapt_framework');
}

function getMigrationConfig(callback) {
  var confPath = path.join(configuration.serverRoot, 'conf', 'migrate.json');
  fs.readJson(confPath, callback);
}

/**
 * Adds all migrations to the DB in a down state
 * @param callback
 */
function syncMigrations(callback) {
  getMigrationConfig(function(err, config) {
    if(err){
      return callback(err)
    }

    fs.ensureDir(config.migrationsDir, function(err) {
      if(err){
        return callback(err)
      }

      var migrator = new migrateMongoose({
        migrationsPath: config.migrationsDir,
        dbConnectionUri: config.dbConnectionUri,
        autosync: true
      });

      migrator.sync()
        .then(
          function(value) { return callback(null, value) },
          function(reason) { return callback(reason); }
        )
    });
  });
}

/**
* Checks all releases for the latest to match framework value in config.json
* Recusion required for pagination.
*/
function checkLatestAdaptRepoVersion(repoName, versionLimit, callback) {
  if(typeof versionLimit === 'function') {
    callback = versionLimit;
    versionLimit = undefined;
  }
  // used in pagination
  var nextPage = `https://api.github.com/repos/${DEFAULT_GITHUB_ORG}/${repoName}/releases`;

  var _getReleases = function(done) {
    request({
      headers: {
        'User-Agent': DEFAULT_USER_AGENT
      },
      uri: nextPage,
      method: 'GET'
    }, done);
  };
  var _requestHandler = function(error, response, body) {
    if(response) {
      // we've exceeded the API limit
      if(response.statusCode === 403 && response.headers['x-ratelimit-remaining'] === '0') {
        var reqsReset = new Date(response.headers['x-ratelimit-reset']*1000);
        error = `You have exceeded GitHub's request limit of ${response.headers['x-ratelimit-limit']} requests per hour. Please wait until at least ${reqsReset.toTimeString()} before trying again.`;
      }
      else if(response.statusCode !== 200) {
        error = 'GitubAPI did not respond with a 200 status code.';
      }
    }
    if (error) {
      return callback(new Error(`Couldn't check latest version of ${repoName}. ${error}`));
    }
    nextPage = parseLinkHeader(response.headers.link).next;
    try {
      // parse and sort releases (newest first)
      var releases = JSON.parse(body).sort((a, b) => {
        if(semver.lt(a.tag_name,b.tag_name)) return 1;
        if(semver.gt(a.tag_name,b.tag_name)) return -1;
        return 0;
      });
    } catch(e) {
      return callback(new Error(`Failed to parse GitHub release data\n${e}`));
    }
    var compatibleRelease;
    async.someSeries(releases, function(release, cb) {
      var isFullRelease = !release.draft && !release.prerelease;
      var satisfiesVersion = !versionLimit || semver.satisfies(release.tag_name, versionLimit);

      if (!isFullRelease || !satisfiesVersion) {
        return cb(null, false);
      }

      compatibleRelease = release;
      return cb(null, true);
    }, function(error, satisfied) {
      if(!satisfied) {
        if(nextPage) {
          return _getReleases(_requestHandler);
        }
        error = new Error(`Couldn't find any releases compatible with specified framework version (${versionLimit}), please check that it is a valid version.`);
      }
      if(error) {
        return callback(error);
      }
      callback(error, compatibleRelease.tag_name);
    });
  };
  // start recursion
  _getReleases(_requestHandler);
}

// taken from https://gist.github.com/niallo/3109252
function parseLinkHeader(header) {
  if (!header || header.length === 0) {
    return [];
  }
  var links = {};
  // Parse each part into a named link
  _.each(header.split(','), function(p) {
    var section = p.split(';');
    if (section.length !== 2) {
      throw new Error("section could not be split on ';'");
    }
    var url = section[0].replace(/<(.*)>/, '$1').trim();
    var name = section[1].replace(/rel="(.*)"/, '$1').trim();
    links[name] = url;
  });
  return links;
}

/**
* Clones/updates the temp/ framework folder
* Accepts the following options: {
*   repository: URL to pull framework from,
*   revision: in the format tags/[TAG] or remote/[BRANCH],
*   force: forces a clone regardless of whether we have an existing clone,
* }
*/
function installFramework(opts, callback) {
  if(arguments.length !== 2 || !opts.directory) {
    return callback(new Error('Cannot install framework, invalid options passed.'));
  }
  if(!opts.repository) {
    opts.repository = DEFAULT_FRAMEWORK_REPO;
  }
  if(!opts.revision) {
    return getLatestFrameworkVersion(function(error, version) {
      // NOTE we default to the master branch
      opts.revision = version || 'master';
      installFramework(opts, callback);
    });
  }
  if(fs.existsSync(opts.directory) && !opts.force) {
    return updateFramework(opts, callback);
  }
  async.applyEachSeries([ cloneRepo, updateFramework ], opts)(callback);
}

function updateFramework(opts, callback) {
  if(opts && !opts.repository) {
    opts.repository = DEFAULT_FRAMEWORK_REPO;
  }
  async.applyEachSeries([
    updateRepo,
    installDependencies,
    purgeCourseFolder,
    updateFrameworkPlugins
  ], opts)(callback);
}

function checkOptions(opts, action, callback) {
  if(!opts) {
    return callback(new Error(`Cannot ${action} repository, invalid options passed.`));
  }
  if(!opts.repository) {
    return callback(new Error(`Cannot ${action} repository, no repository specified.`));
  }
  if(!opts.directory) {
    return callback(new Error(`Cannot ${action} ${opts.repository}, no target directory specified.`));
  }
  callback();
}

function cloneRepo(opts, callback) {
  checkOptions(opts, 'clone', function(error) {
    if(error) {
      return callback(error);
    }
    showSpinner(`Cloning ${opts.repository}`);
    fs.remove(opts.directory, function(error) {
      if(error) {
        hideSpinner();
        return callback(error);
      }
      execCommand(`git clone ${opts.repository} --origin ${REMOTE_NAME} --branch ${opts.revision} "${opts.directory}"`, function(error) {
        hideSpinner();
        if(error) {
          return callback(error);
        }
        log(`Cloned ${opts.repository} successfully.`);
        callback();
      });
    });
  });
}

function fetchRepo(opts, callback) {
  checkOptions(opts, 'fetch', function(error) {
    if(error) {
      return callback(error);
    }
    execCommand(`git fetch ${REMOTE_NAME}`, { cwd: opts.directory }, function(error) {
      // HACK not an ideal way to figure out if it's the right error...
      if(error && error.indexOf(`'${REMOTE_NAME}' does not appear to be a git repository`) > -1) {
        error = new Error(`Remote with name '${REMOTE_NAME}' not found. Check it exists and try again.`);
      }
      callback(error);
    });
  });
}

function updateRepo(opts, callback) {
  fetchRepo(opts, function(error) {
    if(error) {
      return callback(error);
    }
    checkOptions(opts, 'update', function(error) {
      if(error) {
        return callback(error);
      }
      var shortDir = opts.directory.replace(configuration.serverRoot, '') || opts.directory;
      showSpinner(`Updating ${shortDir} to ${opts.revision}`);

      execCommand(`git reset --hard && git checkout ${opts.revision}`, {
        cwd: opts.directory
      }, function(error) {
        hideSpinner();
        if(error) {
          return callback(error);
        }
        log(`${shortDir} switched to revision ${opts.revision}`);
        callback();
      });
    });
  });
}

/**
* Uses adapt.json to install the latest plugin versions
*/
function updateFrameworkPlugins(opts, callback) {
  if(arguments.length !== 2) {
    return callback(new Error('Cannot update Adapt framework plugins, invalid options passed.'));
  }
  if(!opts.directory) {
    return callback(new Error('Cannot update Adapt framework plugins, no target directory specified.'));
  }
  fs.readJSON(path.join(opts.directory, 'adapt.json'), function(error, json) {
    if (error) {
      return callback(error);
    }
    var plugins = Object.keys(json.dependencies);
    async.eachSeries(plugins, function(plugin, pluginCallback) {
      showSpinner(`Updating Adapt framework plugin '${plugin}'`);
      app.bowermanager.installLatestCompatibleVersion(plugin, error => {
        hideSpinner();
        if(error) { // log, but don't fail (see #1890)
          warn(`Failed to install ${plugin}, ${error}`);
        }
        pluginCallback();
      });
    }, function(error) {
      hideSpinner();
      if(error) {
        return callback(error);
      }
      log('Adapt framework plugins updated.');
      callback();
    });
  });
}

/**
* This isn't used by the authoring tool
*/
function purgeCourseFolder(opts, callback) {
  if(arguments.length !== 2) {
    return callback(new Error('Cannot remove course folder, invalid options passed.'));
  }
  if(!opts.directory) {
    return callback(new Error('Cannot remove course folder, no target directory specified.'));
  }
  fs.remove(path.join(opts.directory, 'src', 'course'), callback);
}

function updateAuthoring(opts, callback) {
  if(!opts.revision) {
    return callback(new Error('Cannot update server, revision not specified.'));
  }
  if(!opts.repository) {
    opts.repository = DEFAULT_SERVER_REPO;
  }
  async.series([
    function fetchLatest(cb) {
      fetchRepo(opts, cb);
    },
    function pullLatest(cb) {
      updateRepo(opts, cb);
    },
    function installDeps(cb) {
      installDependencies(cb);
    },
    function rebuildApp(cb) {
      buildAuthoring(cb);
    }
  ], function(error) {
    if(!error) {
      log(`Server has been updated successfully!`);
    }
    callback(error);
  });
}

function buildAuthoring(callback) {
  showSpinner('Building web application');
  execCommand('node ./node_modules/grunt-cli/bin/grunt build:prod', function(error){
    hideSpinner();
    if(error) {
      return callback(error);
    }
    log('Web application built successfully.');
    callback();
  });
}

function installDependencies(opts, callback) {
  if(arguments.length === 1) {
    callback = opts;
  }
  showSpinner(`Installing node dependencies`);

  var cwd = opts.directory || configuration.serverRoot;

  fs.remove(path.join(cwd, 'node_modules'), function(error) {
    if(error) {
      return callback(error);
    }
    execCommand('npm install --loglevel error --production', { cwd: cwd }, function(error) {
      hideSpinner();
      if(error) {
        return callback(error);
      }
      log('Node dependencies installed successfully.');
      callback();
    });
  });
}

function execCommand(cmd, opts, callback) {
  if(arguments.length === 2) {
    callback = opts;
    opts = {};
  }
  var stdoutData = '';
  var errData = '';
  var child = exec(cmd, _.extend({ stdio: [0, 'pipe', 'pipe'] }, opts));
  child.stdout.on('data', function(data) { stdoutData += data; });
  child.stderr.on('data', function(data) { errData += data; });
  child.on('exit', function(error) {
    if(error) {
      return callback(errData || error);
    }
    callback(null, stdoutData);
  });
}

function log(msg) {
  if(!isSilent()) console.log(msg);
}
function ok(msg) {
  log(chalk.green(msg));
}
function warn(msg) {
  log(chalk.yellow(msg));
}
function error(msg) {
  log(chalk.red(msg));
}

function isSilent() {
  return process.env.SILENT;
}
