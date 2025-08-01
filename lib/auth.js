// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
/**
 * Auth plugins are a wrapper for passportjs strategies.
 *
 */

var async = require('async');
var bcrypt = require('bcrypt-nodejs');
var fs = require('fs');
var junk = require('junk');
var path = require('path');
var util = require('util');
var passport = require('passport');

var configuration = require('./configuration');
var database = require('./database');
var ObjectId = require('mongoose').Types.ObjectId;
var logger = require('./logger');
var rest = require('./rest');
var permissions = require('./permissions');
var pluginmanager = require('./pluginmanager');
var tenantmanager = require('./tenantmanager');
var usermanager = require('./usermanager');


// private hash for memoizing auth plugins
var _authPlugins = Object.create(null);
var _otherLoginLinks = [];

/*
 * CONSTANTS
 */
var MODNAME = 'authentication';
var WAITFOR = 'pluginmanager';

// custom errors
function UserRegistrationError(message) {
  this.name = 'UserRegistrationError';
  this.message = message || 'User registration error';
}

function UserResetPasswordError(message) {
  this.name = 'UserResetPasswordError';
  this.message = message || 'User reset password error';
}

function UserGenerateTokenError(message) {
  this.name = 'UserGenerateTokenError';
  this.message = message || 'User generate token error';
}

util.inherits(UserRegistrationError, Error);
util.inherits(UserResetPasswordError, Error);
util.inherits(UserGenerateTokenError, Error);

function AuthPlugin() {
  this.type = 'none';
}

AuthPlugin.prototype.init = function (app) {
  throw new Error('AuthPlugin#init must be overridden in extending object');
};

AuthPlugin.prototype.authenticate = function (req, res, next) {
  throw new Error('AuthPlugin#authenticate must be overridden in extending object');
};

AuthPlugin.prototype.validateMfaToken = function (req, res, next) {
  throw new Error('AuthPlugin#validateMfaToken must be overridden in extending object');
};

AuthPlugin.prototype.getLoginHtml = function () {
  return '';
};

AuthPlugin.prototype.disavow = function (req, res, next) {
  throw new Error('AuthPlugin#disavow must be overridden in extending object');
};

AuthPlugin.prototype.internalRegisterUser = function (retypePasswordRequired, user, cb) {
  throw new Error('AuthPlugin#internalRegisterUser must be overridden in extending object');
};

AuthPlugin.prototype.resetPassword = function (req, res, next) {
  throw new Error('AuthPlugin#resetPassword must be overridden in extending object');
};

AuthPlugin.prototype.internalUpdatePassword = function (user, cb) {
  throw new Error('AuthPlugin#internalResetPassword must be overridden in extending object');
};

AuthPlugin.prototype.generateResetToken = function (req, res, next) {
  throw new Error('AuthPlugin#generateResetToken must be overridden in extending object');
};

AuthPlugin.prototype.generateMfaToken = function (req, res, next) {
  throw new Error('AuthPlugin#generateMfaToken must be overridden in extending object');
};

AuthPlugin.prototype.internalGenerateResetToken = function (user, cb) {
  throw new Error('AuthPlugin#internalGenerateResetToken must be overridden in extending object');
};

AuthPlugin.prototype.isTenantEnabled = function (user, cb) {
  tenantmanager.retrieveTenant({ _id: user._tenantId }, function (err, tenant) {
    if (err) {
      return cb(err);
    }

    return cb(null, (tenant && !tenant._isDeleted));
  });
};

exports = module.exports = {

  errors: {
    'UserRegistrationError': UserRegistrationError,
    'UserResetPasswordError': UserResetPasswordError,
    'UserGenerateTokenError': UserGenerateTokenError
  },

  /**
   * Exposes plugin object
   *
   */

  AuthPlugin: AuthPlugin,

  /**
   * hashes a password using bcrypt
   *
   * @param {string} password - plaintext password
   * @param {callback} cb - func (err, hash)
   */

  hashPassword: function (password, cb) {
    bcrypt.genSalt(10, function (err, salt) {
      bcrypt.hash(password, salt, null, cb);
    });
  },

  /**
   * checks a plaintext password against a stored hash
   *
   * @param {string} password - plaintext password
   * @param {string} hash - stored hash
   * @param {callback} cb - func (err, valid)
   */

  validatePassword: function (password, hash, cb) {
    bcrypt.compare(password, hash, cb);
  },

  /**
   * Generates a random token
   * @param {callback} cb - func (err, token)
   */
  createToken: function (cb) {
    require('crypto').randomBytes(12, function (ex, buf) {
      return cb(null, buf.toString('hex'));
    });
  },

  createMfaToken: function (cb) {
    require('crypto').randomInt(100000, 1000000, function (ex, code) {
      return cb(null, String(code).padStart(6, '0'));
    })
  },

  generateTokenId: function (cb) {
    var self = this;
    require('crypto').randomBytes(24, function (ex, buf) {
      return cb(null, self.encodeBase64Url(buf));
    });
  },

  signTokenId: function (tokenId) {
    var self = this;
    var secret = app.configuration.getConfig('sessionSecret');
    var signature = require('crypto').createHmac('sha256', secret)
      .update(tokenId)
      .digest('base64url');
    signature = self.encodeBase64Url(signature);
    return `s%3A${tokenId}.${signature}`
  },

  validateTokenIdSignature: function (key, cb) {
    var self = this;
    var crypto = require('crypto');
    var secret = app.configuration.getConfig('sessionSecret');
    const match = key.match(/^s%3A([^\.]+)\.(.+)$/);
    if (!match) {
      cb('Token signature could not be validated');
    } else {
      const token = match[1];
      const providedSignature = match[2];

      var expectedSignature = crypto.createHmac('sha256', secret)
        .update(token)
        .digest('base64url');

      expectedSignature = self.encodeBase64Url(expectedSignature);
      if (crypto.timingSafeEqual(Buffer.from(String(providedSignature)), Buffer.from(String(expectedSignature)))) {
        cb(null, token)
      } else {
        cb('Token signature could not be validated')
      }
    }
  },


  encodeBase64Url: function (buffer) {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
  },

  /**
   * wrapper for passport.session
   *
   */

  session: function () {
    return passport.session();
  },

  /**
   * wrapper for passport.initialize
   *
   */

  initialize: function () {
    return passport.initialize();
  },

  /**
   * preload function sets up event listener for startup events
   *
   * @param {object} app - the Origin instance
   * @return {object} preloader - a ModulePreloader
   */
  preload: function (app) {
    var preloader = new app.ModulePreloader(app, MODNAME, { events: preloadHandle(app, this) });
    return preloader;
  },

  /**
   * gets the authentication plugin of the specified name
   *
   * @param {string} name - the name of the plugin
   * @param {callback} cb - func(err, plugin)
   */
  getAuthPlugin: function (name, cb) {
    // early return if we have fetched it before
    if (_authPlugins[name] && _authPlugins[name] instanceof AuthPlugin) {
      return cb(null, _authPlugins[name]);
    }

    var pluginManager = pluginmanager.getManager();
    pluginManager.getPlugin('auth', name, function (error, pluginInfo) {
      if (error) {
        logger.log('error', 'Failed to retrieve auth plugin', error);
        return cb(error);
      }

      try {
        var Auth = require(pluginInfo.fullPath);
        _authPlugins[name] = new Auth();
        _authPlugins[name].init(app, function (err) {
          if (err) {
            return cb(err);
          }

          var loginHtml = _authPlugins[name].getLoginHtml();

          if (loginHtml.length !== 0) {
            _otherLoginLinks.push(loginHtml)
          }
          return cb(null, _authPlugins[name]);
        });

      } catch (err) {
        return cb(err);
      }

    });
  },

  /**
   * reads the auth plugin directory and returns the names
   * of available plugins
   *
   * @return array
   */

  getAvailableAuthPluginsSync: function () {
    return fs.readdirSync(path.join(configuration.serverRoot, 'plugins', 'auth')).filter(junk.not);
  },

  loadAuthPlugins: function (next) {
    // Load all auth plugins here
    logger.log('info', 'Supporting the following authentication types:')
    var self = this;

    async.eachSeries(
      self.getAvailableAuthPluginsSync(),
      function (pluginName, nextPlugin) {
        logger.log('info', '- ' + pluginName);
        self.getAuthPlugin(pluginName, nextPlugin);
      },
      next
    );
  }
};

/**
 * Event handler for preload events
 *
 * @param {object} app - Server instance
 * @param {object} instance - Instance of this module
 * @return {object} hash map of events and handlers
 */
function preloadHandle(app, instance) {

  return {
    preload: function () {
      var preloader = this;
      preloader.emit('preloadChange', MODNAME, app.preloadConstants.WAITING);
    },

    moduleLoaded: function (modloaded) {
      var preloader = this;

      //is the module that loaded this modules requirement
      if (modloaded === WAITFOR) {

        preloader.emit('preloadChange', MODNAME, app.preloadConstants.LOADING);

        // set up (de)serialization
        passport.serializeUser(usermanager.serializeUser.bind(usermanager));
        passport.deserializeUser(usermanager.deserializeUser.bind(usermanager));

        rest.post('/login', function (req, res, next) {
          instance.getAuthPlugin(configuration.getConfig('auth'), function (error, authPlugin) {
            if (error) {
              return next({ statusCode: 500, message: error }, req, res);
            }
            authPlugin.authenticate(req, res, next);
          });
        });

        rest.post('/loginMfa', function (req, res, next) {
          instance.getAuthPlugin(configuration.getConfig('auth'), function (error, authPlugin) {
            if (error) {
              return next({ statusCode: 500, message: error }, req, res);
            }
            authPlugin.validateMfaToken(req, res, next);
          });
        });

        rest.post('/newLoginMfaToken', function (req, res, next) {
          usermanager.retrieveUser({ email: req.body.email, auth: 'local' }, function (error, user) {
            if (error) {
              logger.log('error', error);
              res.statusCode = 400;
              return res.json({ success: false });
            }
            if (user) {
              if (user.mfaResetCount >= configuration.getConfig('maxLoginAttempts') || user.failedMfaCount >= configuration.getConfig('maxLoginAttempts')) {
                logger.log('error', 'mfa resent more than 3 times or failed more than 3 times, email locked!');
                res.statusCode = 401;
                return res.json({ success: false, errorCode: 'mfaResetCount' });
              }
              instance.getAuthPlugin(configuration.getConfig('auth'), function (error, authPlugin) {
                if (error) {
                  return next({ statusCode: 500, message: error }, req, res);
                }

                authPlugin.generateMfaToken(user, req, function (error, userRecord) {
                  if (error) {
                    return next({ statusCode: 500, message: error }, req, res);
                  }
                  return res.status(200).json({})
                });
              });
            }
          });

        });

        rest.post('/logout', function (req, res, next) {
          instance.getAuthPlugin(configuration.getConfig('auth'), function (error, authPlugin) {
            if (error) {
              return next({ statusCode: 500, message: error }, req, res);
            }

            authPlugin.disavow(req, res, next);
          });
        });

        rest.get('/authcheck', function (req, res, next) {
          var passport = req.session.passport;
          var user = passport && passport.user;
          var tokenExpired = true;
          var tokenVerified = false;
          var requireMfa = app.configuration.getConfig('useMFA') || false;
          var cookieKey = app.configuration.getConfig('devEnv') ? `connect-${app.configuration.getConfig('devEnv')}.fid` : 'connect.fid'
          var tokenId = req && req.cookies && req.cookies[cookieKey];

          function setCredentialsValidity(isAuthenticated) {
            var result = {
              isAuthenticated: isAuthenticated,
              id: (user && user._id) ? user._id : 0,
              tenantId: (user && user.tenant) ? user.tenant._id : '',
              tenantName: (user && user.tenant) ? user.tenant.name : '',
              email: (user && user.email) ? user.email : '',
              otherLoginLinks: _otherLoginLinks
            };

            // When first logging in - the user object doesn't
            // exist so we need to set the permissions to an empty array
            if (!user) {
              result.permissions = [];
              res.statusCode = 200;
              return res.json(result);
            }

            //Used to get the users permissions
            permissions.getUserPermissions(user._id, function (error, userPermissions) {
              if (error) {
                return next(error);
              }
              result.permissions = userPermissions;
              res.statusCode = 200;
              return res.json(result);
            });
          }

          function verifyTokenValidity(token) {
            usermanager.retrieveMfaToken({
              $or: [
                { tokenId: token },
                { sessionId: req.sessionID }
              ]
            }, function (error, data) {
              if (error) {
                logger.log('error', error);
                return next(error);
              }
              if (data && data.length) {
                var token = data[0];
                var currentDate = new Date();
                var THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
                tokenExpired = token.validationDate === null ? true : (currentDate - token.validationDate) > THIRTY_DAYS;
                tokenVerified = token.verified;
                var isAuthenticated = (user && user._id && tokenVerified && !tokenExpired);
                setCredentialsValidity(isAuthenticated);
              } else {
                var result = { permissions: [] };
                res.statusCode = 200;
                return res.json(result);
              }
            });
          }

          if (requireMfa) {
            if (tokenId) {
              instance.validateTokenIdSignature(tokenId, function (error, token) {
                if (error) {
                  logger.log('error', error);
                  var result = { permissions: [] };
                  res.statusCode = 200;
                  return res.json(result);
                }
                verifyTokenValidity(token);
              });
            } else {
              verifyTokenValidity(null);
            }
          } else {
            var isAuthenticated = (user && user._id) ? true : false;
            setCredentialsValidity(isAuthenticated);
          }
        });

        rest.put('/userpasswordreset/:token', function (req, res, next) {
          var delta = req.body;

          instance.getAuthPlugin(configuration.getConfig('auth'), function (error, authPlugin) {
            if (error) {
              return next({ statusCode: 500, message: error }, req, res);
            }


            authPlugin.resetPassword(req, res, next);
          });
        });

        rest.post('/createtoken', function (req, res, next) {
          instance.getAuthPlugin(configuration.getConfig('auth'), function (error, authPlugin) {
            if (error) {
              return next({ statusCode: 500, message: error }, req, res);
            }

            authPlugin.generateResetToken(req, res, next);
          });
        });

        instance.loadAuthPlugins(function () {
          preloader.emit('preloadChange', MODNAME, app.preloadConstants.COMPLETE);
        });
      }
    }
  };
};
