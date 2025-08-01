// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
module.exports = function(grunt) {
  require('matchdep').filterAll('grunt-*').forEach(grunt.loadNpmTasks);
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    'generate-lang-json': {
      options: {
        langFileExt: '.json',
        src: {
          backend: 'routes/lang',
          frontend: 'frontend/src/**/lang'
        },
        dest: 'temp/lang'
      }
    },
    copy: {
      main: {
        files: [
          {
            expand: true,
            flatten: true,
            src: [
              'frontend/src/core/**/assets/**',
              'frontend/src/modules/**/assets/**',
              'frontend/src/plugins/**/assets/**',
              'frontend/src/libraries/**/assets/**'
            ],
            dest: 'frontend/build/css/assets/',
            filter: 'isFile'
          },
          {
            expand: true,
            flatten: true,
            src: ['frontend/src/libraries/ace/*'],
            dest: 'frontend/build/js/ace'
          }
        ]
      }
    },
    less: {
      dev: {
        options: {
          baseUrl: 'frontend/src',
          src: [
            'frontend/src/core/**/*.less',
            'frontend/src/modules/**/*.less',
            'frontend/src/plugins/**/*.less',
            'frontend/src/libraries/**/*.less'
          ],
          paths: 'frontend/src/core/less',
          modifyVars: {
            'adapt-topbar-color': '#9a3434',
            'adapt-secondary-color': '#9a3434'
          },
          generateSourceMaps: true,
          compress: false,
          dest: 'frontend/build/css',
          cssFilename: 'adapt.css',
          mapFilename: 'adapt.css.map'
        }
      },
      compile: {
        options: {
          baseUrl: 'frontend/src',
          src: [
            'frontend/src/core/**/*.less',
            'frontend/src/less/**/*.less',
            'frontend/src/modules/**/*.less',
            'frontend/src/plugins/**/*.less',
            'frontend/src/libraries/**/*.less'
          ],
          paths: 'frontend/src/core/less',
          generateSourceMaps: false,
          compress: true,
          dest: 'frontend/build/css',
          cssFilename: 'adapt.css',
          mapFilename: 'adapt.css.map'
        }
      }
    },
    handlebars: {
      compile: {
        options: {
          amd: true,
          namespace:"Handlebars.templates",
          processName: function(filePath) {
            var newFilePath = filePath.split("/");
            newFilePath = newFilePath[newFilePath.length - 1].replace(/\.[^/.]+$/, "");
            return  newFilePath;
          },
          partialRegex: /^part_/,
          partialsPathRegex: /\/partials\//
        },
        files: [
          {
            follow: true,
            src: [
              'frontend/src/core/**/*.hbs',
              'frontend/src/modules/**/*.hbs',
              'frontend/src/plugins/**/*.hbs'
            ],
            dest: 'frontend/src/templates/templates.js'
          }
        ]
      }
    },
    requirejs: {
      dev: {
        options: {
          baseUrl: 'frontend/src',
          name: 'core/app',
          mainConfigFile: "frontend/src/core/config.js",
          out: "frontend/build/js/origin.js",
          generateSourceMaps: true,
          preserveLicenseComments: true,
          optimize: "none"
        }
      },
      compile: {
        options: {
          baseUrl: 'frontend/src',
          name: 'core/app',
          mainConfigFile: "frontend/src/core/config.js",
          out: "frontend/build/js/origin.js",
          optimize: "none"
        }
      }
    },
    mochaTest: {
      src: ['test/*.js'],
      options: {
        reporter: 'mochawesome',
        noFail: true,
        timeout: 3500,
        reporterOptions: {
          reportDir: 'test/output/unit', // Set your desired directory
          reportFilename: 'unit-report.json' // Optional: Customize the report name
        }
      }
    },
    requireBundle: {
      modules: {
        src: 'frontend/src/modules/*',
        dest: 'frontend/src/modules/modules.js'
      },
      plugins: {
        src: 'frontend/src/plugins/*',
        dest: 'frontend/src/plugins/plugins.js'
      }
    }
  });

  grunt.registerTask('migration-conf', 'Creating migration Conf', function() {
    var mongoUri = require('mongodb-uri');
    var config = grunt.file.readJSON('conf/config.json');
    var connectionString = '';

    if (config.dbConnectionUri) {
      connectionString = config.dbConnectionUri;

      var dbConnectionUriParsed = mongoUri.parse(connectionString);
      dbConnectionUriParsed.database = config.dbName;
      connectionString = mongoUri.format(dbConnectionUriParsed);

    } else {
      // Construct the authentication part of the connection string.
      var authenticationString = config.dbUser && config.dbPass ? config.dbUser + ':' + config.dbPass + '@' : '';

      // Check if a MongoDB replicaset array has been specified.
      if (config.dbReplicaset && Array.isArray(config.dbReplicaset) && config.dbReplicaset.length !== 0) {
        // The replicaset should contain an array of hosts and ports
        connectionString = 'mongodb://' + authenticationString + config.dbReplicaset.join(',') + '/' + config.dbName
      } else {
        // Get the host and port number from the configuration.

        var portString = config.dbPort ? ':' + config.dbPort : '';

        connectionString = 'mongodb://' + authenticationString + config.dbHost + portString + '/' + config.dbName;
      }
      if (typeof config.dbAuthSource === 'string' && config.dbAuthSource !== '' ) {
        connectionString += '?authSource=' + config.dbAuthSource
      }
    }
    var migrateConf = {
      migrationsDir : 'migrations/lib',
      es6 : false,
      dbConnectionUri: connectionString
    };
    grunt.file.write('conf/migrate.json', JSON.stringify(migrateConf, null, 2));
  });

  // Compiles frontend plugins
  grunt.registerMultiTask('requireBundle', 'Generates a .js file with a bunch of imports for the path files', function() {
    var modulePaths = '';
    // Go through each subfolder in the plugins directory
    var foldersArray = grunt.file.expand({ filter: "isDirectory" }, this.data.src);
    // Check if any plugins are available
    if (foldersArray.length === 0) {
      modulePaths += "'";
    }
    foldersArray.forEach(function(path, index, folders) {
      // Strip off front of path to make relative path to config file
      var relativePath = path.replace(grunt.config.get('requirejs').dev.options.baseUrl, '').slice(1);
      var splitter = "','";
      if (index === folders.length - 1) splitter = "'";
      modulePaths += relativePath + '/index' + splitter;
    });
    grunt.file.write(this.data.dest, "define(['" + modulePaths +"], function() {});");
  });

  grunt.registerMultiTask('less', 'Compile Less files to CSS', function() {
    var path = require('path');
    var less = require('less');
    var options = this.options({});
    var shouldGenerateSourceMaps = options.generateSourceMaps;
    var destination = options.dest;
    var mapFilename = options.mapFilename;
    var imports = getImports();
    var lessOptions = getLessOptions();
    var sourceMapPath = path.join(destination, mapFilename);
    var importsPath = sourceMapPath + '.imports';
    var done = this.async();

    if (!shouldGenerateSourceMaps) removeSourceMaps();

    less.render(imports, lessOptions, complete);

    function getImports() {
      var src = options.src;
      var ret = '';

      for (var i = 0, l = src.length; i < l; i++) {
        grunt.file.expand({
          filter: options.filter,
          follow: true
        }, src[i]).forEach(function(lessPath) {
          ret += '@import \'' + path.normalize(lessPath) + '\';\n';
        });
      }
      return ret;
    }

    function getLessOptions() {
      var ret = {
        compress: options.compress,
        paths: options.paths,
        modifyVars: options.modifyVars
      };
      if (shouldGenerateSourceMaps) {
        ret.sourceMap = {
          'sourceMapFileInline': false,
          'outputSourceFiles': true,
          'sourceMapBasepath': 'src',
          'sourceMapURL': mapFilename
        };
      }
      return ret;
    }

    function removeSourceMaps() {
      if (grunt.file.exists(sourceMapPath)) {
        grunt.file.delete(sourceMapPath, { force: true });
      }
      if (grunt.file.exists(importsPath)) {
        grunt.file.delete(importsPath, { force: true });
      }
    }

    function complete(error, output) {
      if (error) return grunt.fail.fatal(JSON.stringify(error, false, ' '));

      var outputMap = output.map;

      if (outputMap) {
        grunt.file.write(sourceMapPath, outputMap);
        grunt.file.write(importsPath, imports);
      }
      grunt.file.write(path.join(destination, options.cssFilename), output.css);
      done();
    }
  });
  grunt.registerTask('generate-lang-json', function() {
    const fs = require('fs-extra');
    const path = require('path');

    const options = this.options();
    const backendGlob = path.join(options.src.backend, `*${options.langFileExt}`);
    const dest = options.dest;
    // load each route lang file
    /**
    * NOTE there must be a file in routes/lang for the language to be loaded,
    * won't work if you've only got lang files in frontend
    */
    grunt.file.expand({}, path.join(backendGlob)).forEach(backendPath => {
      const basename = path.basename(backendPath);
      const frontendGlob = path.join(options.src.frontend, basename);
      let data = { ...fs.readJSONSync(backendPath) };
      // load all matching frontend lang files
      grunt.file.expand({}, frontendGlob).forEach(frontendPath => {
        data = { ...data, ...fs.readJSONSync(frontendPath) };
      });
      fs.ensureDirSync(dest);
      fs.writeJSONSync(path.join(dest, basename), data, { spaces: 2 });
    });
  });

  grunt.registerTask('default', ['build:dev']);
  grunt.registerTask('test', ['mochaTest']);

  grunt.registerTask('update-build-number', function (key, value) {
    var configFile = "conf/config.json";
    if (!grunt.file.exists(configFile)) {
        grunt.log.error("file " + configFile + " not found");
        return false;
    }
    var json = grunt.file.readJSON(configFile);
    if (!json.buildNumber) {
      json.buildNumber = 0;
    }
    if (!json.buildPrefix) {
      json.buildPrefix = 'BUILD';
    }
    json.buildNumber++;
    grunt.file.write(configFile, JSON.stringify(json, null, 2));
});

  /**
  * Accepts 'build', 'translate' and 'prod' params
  * e.g. grunt build:prod
  */
  grunt.registerTask('build', 'Running build', function(mode) {
    grunt.log.subhead(`Building application in ${mode === 'prod' ? 'production' : 'dev'} mode`);

    var isProduction = mode === 'prod' ? true : false;
    var compilation = isProduction ? 'compile' : 'dev';

    if(mode === 'translate'){
      var configFile = 'conf/config.json';
      var config = grunt.file.readJSON(configFile);
      config.translating = true;
      grunt.file.write(configFile, JSON.stringify(config, null, 2));
      var compilation = 'compile';
    } else {
      var configFile = 'conf/config.json';
      var config = grunt.file.readJSON(configFile);
      config.translating = false;
      grunt.file.write(configFile, JSON.stringify(config, null, 2));
    }

    try {
      // add flag to config
      var configFile = 'conf/config.json';
      var config = grunt.file.readJSON(configFile);
      config.isProduction = isProduction;
      grunt.file.write(configFile, JSON.stringify(config, null, 2));
      // run the task
      grunt.task.run(['migration-conf', 'requireBundle', 'generate-lang-json', 'copy', 'less:' + compilation, 'handlebars', 'requirejs:'+ compilation, 'update-build-number']);

    } catch(e) {
      grunt.task.run(['requireBundle', 'copy', 'less:' + compilation, 'handlebars', 'requirejs:' + compilation]);
    }
  });
};
