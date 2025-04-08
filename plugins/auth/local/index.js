// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
/**
 * offers passport-local style authentication
 */

const { app } = require('../../../lib/rest');

var auth = require('../../../lib/auth'),
    configuration = require('../../../lib/configuration'),
    usermanager = require('../../../lib/usermanager'),
    util = require('util'),
    fs = require('fs'),
    path = require('path'),
    passport = require('passport'),
    permissions = require('../../../lib/permissions'),
    logger = require('../../../lib/logger'),
    LocalStrategy = require('passport-local').Strategy;

var MESSAGES = {
  INVALID_USERNAME_OR_PASSWORD: 'Invalid username or password',
  ACCOUNT_LOCKED: 'Account locked -- contact an administrator to unlock'
};

var ERROR_CODES = {
  INVALID_USERNAME_OR_PASSWORD: 1,
  ACCOUNT_LOCKED: 2,
  MISSING_FIELDS: 3,
  TENANT_DISABLED: 4,
  ACCOUNT_INACTIVE: 5
};

function LocalAuth() {
  this.strategy = new LocalStrategy({ usernameField: 'email' }, this.verifyUser);
  passport.use(this.strategy);
}

util.inherits(LocalAuth, auth.AuthPlugin);

LocalAuth.prototype.init = function (app, next) {
  return next(null);
};

LocalAuth.prototype.verifyUser = function (email, password, done) {
  // Retrieve the user and compare details with those provided
  usermanager.retrieveUser({ email: new RegExp(email, 'i'), auth: 'local' }, function (error, user) {
    if (error) {
      return done(error);
    }

    if (!user) {
      return done(null, false, {
        message: MESSAGES.INVALID_USERNAME_OR_PASSWORD,
        errorCode: ERROR_CODES.INVALID_USERNAME_OR_PASSWORD
      });
    }

    if (user.failedLoginCount < configuration.getConfig('maxLoginAttempts')) {
      // Validate the user's password
      auth.validatePassword(password, user.password, function (error, valid) {
        if (error) {
          return done(error);
        }

        // Did password check out?
        if (!valid) {
          // Increment the count of failed attempts
          var failedCount = user.failedLoginCount ? user.failedLoginCount : 0;

          failedCount++;

          var delta = {
            failedLoginCount: failedCount
          };

          usermanager.updateUser({ email: user.email }, delta, function(error) {
            if (error) {
              return done(error);
            }

            return done(null, false, {
              message: MESSAGES.INVALID_USERNAME_OR_PASSWORD,
              errorCode: ERROR_CODES.INVALID_USERNAME_OR_PASSWORD
            });
          });
        } else {
          usermanager.updateUser({ email: user.email }, { failedLoginCount: 0 }, function(error) {
            if (error) {
              return done(error);
            }

            return done(null, user);
          });
        }
      });
    } else {
      // Indicate that the account is locked out
      return done(null, false, {
        message: MESSAGES.ACCOUNT_LOCKED,
        errorCode: ERROR_CODES.ACCOUNT_LOCKED
      });
    }
  });
};

LocalAuth.prototype.authenticate = function (req, res, next) {
  var self = this;
  return passport.authenticate('local', function (error, user, info) {
    if (error) {
      return next(error);
    }
    if(!user) {
      return res.status(401).json({ errorCode: info.errorCode});
    }

    // check user is not deleted
    if (user._isDeleted) {
      return res.status(401).json({ errorCode: ERROR_CODES.ACCOUNT_INACTIVE });
    }

    // NEEDS MFA REFACTOR
    var requireMfa = app.mailservice.useMailService && !req.cookies.skipMfa;

    user.validationDate = requireMfa ? null : new Date();

    // check tenant is enabled
    self.isTenantEnabled(user, function (err, isEnabled) {
      if (!isEnabled) {
        return res.status(401).json({ errorCode: ERROR_CODES.TENANT_DISABLED });
      }
      // Store the login details
      req.logIn(user, function (error) {
        if (error) {
          return next(error);
        }
        usermanager.logAccess(user, function(error) {
          if (error) {
            return next(error);
          }

          const authenticateCbFn = function () {
            //Used to get the users permissions
            permissions.getUserPermissions(user._id, function(error, userPermissions) {
              if (error) {
                return next(error);
              }
              if (req.body.shouldPersist && req.body.shouldPersist == 'true') {
                // Session is persisted for 2 weeks if the user has set 'Remember me'
                req.session.cookie.maxAge = 14 * 24 * 3600000;
              } else {
                req.session.cookie.expires = false;
              }
              return res.status(200).json({
                id: user._id,
                email: user.email,
                // NEEDS MFA REFACTOR
                validationDate: user.validationDate,
                requireMfa: requireMfa,
                tenantId: user._tenantId,
                tenantName: req.session.passport.user.tenant.name,
                permissions: userPermissions
              });
            });
          }

          if (requireMfa) {
            self.generateMfaToken(user, function(error, userRecord){
              if (error) {
                return next(error);
              }
              authenticateCbFn();
            });
          }
          else {
            authenticateCbFn();
          }
        });
      });
    });

  })(req, res, next);
};

LocalAuth.prototype.validateMfaToken = function (req, res, next) {
  let MAX_TOKEN_AGE = 10; // in minutes
  const xMinutesAgo = function (minutes) {
    var now = new Date();
    return now.getTime() - (1000 * 60 * minutes);
  };

  let timestampMinAge = xMinutesAgo(MAX_TOKEN_AGE);

  if (req.body.shouldSkipMfa && req.body.shouldSkipMfa == 'true') {
    res.cookie('skipMfa', true, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
      httpOnly: false
    });
  }
  // NEEDS MFA REFACTOR
  usermanager.retrieveUser({ email: req.body.email, auth: 'local' }, function (error, userRecord) {
    if (error) {
      logger.log('error', error);
      res.statusCode = 400;
      return res.json({ success: false });
    }

    if (userRecord) {
      if (userRecord.validationToken === req.body.token && userRecord.validationTokenIssueDate.getTime() > timestampMinAge) {
        let delta = {
          validationDate: new Date()
        }
        usermanager.updateUser({email: req.body.email}, delta, function (error, userRecord) {
          if (error) {
            logger.log('error', error);
            return next(error);
          }

          if (req.session && req.session.passport && req.session.passport.user) {
            req.session.passport.user.validationDate = userRecord.validationDate;
          }

          // Success
          return res.status(200).json({
            id: userRecord._id,
            email: userRecord.email,
            validationDate: userRecord.validationDate
          });
        });
      }
      else {
        return next(new auth.errors.UserRegistrationError('Invalid validation token!'));
      }
    } else {
      return next(new auth.errors.UserRegistrationError('Cannot find user email!'));
    }
  });
};

LocalAuth.prototype.disavow = function (req, res, next) {
  req.logout();
  res.status(200).end();
};

LocalAuth.prototype.internalRegisterUser = function(retypePasswordRequired, user, cb) {
  if (retypePasswordRequired) {
    if (!user.email || !user.password || !user.retypePassword) {
      return cb(new auth.errors.UserRegistrationError('email, password and retyped password are required!'));
    }

    if (user.password !== user.retypePassword) {
      return cb(new auth.errors.UserRegistrationError('password and retyped password must match!'));
    }
  }

  if (!user.email || !user.password) {
    return cb(new auth.errors.UserRegistrationError('email and password are required!'));
  }

  // create user with hashed password
  auth.hashPassword(user.password, function (error, hash) {
    if (error) {
      return cb(error);
    }

    user.password = hash;
    user.auth = 'local';
    usermanager.createUser(user, function (error, user) {
      if (error) {
        return cb(error);
      }

      // successfully registered
      return cb(null, user);
    });
  });
};

LocalAuth.prototype.resetPassword = function (req, res, next) {
  var resetPasswordToken = req.body.token;
  var self = this;

  if (!resetPasswordToken) {
    return next(new auth.errors.UserResetPasswordError('Token was not found'));
  }
  usermanager.retrieveUserPasswordReset({ token: resetPasswordToken }, function (error, usrReset) {
    if (error) {
      logger.log('error', error);
      return res.status(500).end();
    }
    if (!usrReset) {
      return res.status(200).json({});
    }
    self.internalResetPassword({ id: usrReset.user, password: req.body.password }, req, function (error, user) {
      if (error) {
        logger.log('error', error);
        return res.status(500).end();
      }
      res.status(200).json(user);
    });
  });
 };

LocalAuth.prototype.internalResetPassword = function (user, req, next) {
  if (!user.id || !user.password) {
    return next(new auth.errors.UserResetPasswordError('User ID and password are required!'));
  }

  // Hash the password
  auth.hashPassword(user.password, function (error, hash) {
    if (error) {
      return cb(error);
    }
    // Update user details with hashed password
    usermanager.updateUser({ _id: user.id }, { password: hash, failedLoginCount: 0, passwordResetCount: 0, lastPasswordChange: new Date().toISOString() }, function(err) {
      if (error) {
        return next(error)
      }
      usermanager.clearOtherSessions(req, user.id);
      usermanager.deleteUserPasswordReset({ user: user.id }, function (error, user) {
        if (error) {
          return next(error);
        }

        //Request deleted, password successfully reset
        return next(null, user);
      });
    });
  });
};

LocalAuth.prototype.generateResetToken = function (req, res, next) {
  var self = this;

  usermanager.retrieveUser({ email: req.body.email, auth: 'local' }, function (error, userRecord) {
    if (error) {
      logger.log('error', error);
      res.statusCode = 400;
      return res.json({ success: false });
    }

    if (userRecord) {
      // var currentDate = Date();
      // if (){
      //   return next({ success: false });
      // }

      var user = {
        email: req.body.email,
        ipAddress: req.connection.remoteAddress
      };

      self.internalGenerateResetToken(user, function (error, userToken) {
        if (error) {
          logger.log('error', error);
          return next(error);
        }

        if (!userToken) {
          return next(new auth.errors.UserGenerateTokenError('In generateResetToken and user object is not set!'));
        }

        emailData = {
          rootUrl: configuration.getConfig('rootUrl'),
          resetToken: userToken.token
        }
        emailTemplate = {
          email: userRecord.email,
          template: 'resetPassword',
          personalisation: {
            name: userRecord.firstName,
            passwordResetLink: `${emailData.rootUrl}#user/reset/${emailData.resetToken}`
          }
        }
        app.mailservice.send(emailTemplate, function(error) {
          if (error) {
            logger.log('error', error.message)
            return res.status(200).json({ success: true });
          }
          logger.log('info', 'Password reset for ' + user.email + ' from ' + user.ipAddress);
          return res.status(200).json({ success: true });
        });
        //var subject = app.polyglot.t('app.emailforgottenpasswordsubject');
        //var body = app.polyglot.t('app.emailforgottenpasswordbody', { rootUrl: configuration.getConfig('rootUrl'), data: userToken.token });
        //var templateData = {
        //  name: 'emails/passwordReset.hbs',
        //  user: user,
        //  showButton: true,
        //  rootUrl: configuration.getConfig('rootUrl'),
        //  resetToken: userToken.token,
        //  resetLabel: app.polyglot.t('app.resetpassword')
        //}
        //app.mailer.send(user.email, subject, body, templateData, function(error) {
        //  if (error) {
        //    return res.status(500).send(error.message);
        //  }
        //
        //  logger.log('info', 'Password reset for ' + user.email + ' from ' + user.ipAddress);
        //  return res.status(200).json({ success: true });
        //});
      });
    } else {
      // Return 200 even if user doesn't exist to prevent brute force hacking
      res.statusCode = 200;
      return res.json({ success: true });
    }
  });
};

LocalAuth.prototype.internalGenerateResetToken = function (user, next) {
  if (!user.email) {
    return next(new auth.errors.UserGenerateTokenError('email is required!'));
  }

  auth.createToken(function (error, token) {
    if (error) {
      return next(error);
    }

    var userReset = {
      email: user.email,
      token: token,
      issueDate: new Date(),
      ipAddress: user.ipAddress
    };

    usermanager.createUserPasswordReset(userReset, function (error, user) {
      if (error) {
        logger.log('error', error);
        return next(error);
      }

      // Success
      return next(null, user);
    });
  });
};

LocalAuth.prototype.generateMfaToken = function (user, next) {
  if (!user.email) {
    return next(new auth.errors.UserGenerateTokenError('email is required!'));
  }

  auth.createMfaToken(function (error, token) {
    if (error) {
      return next(error);
    }

    console.log('createMfaToken token: ', token);

    var delta = {
      validationToken: token,
      validationTokenIssueDate: new Date(),
      validationDate: null
    };

    // NEEDS MFA REFACTOR
    usermanager.updateUser({email: user.email}, delta, function (error, userRecord) {
      if (error) {
        logger.log('error', error);
        return next(error);
      }

      emailTemplate = {
        email: userRecord.email,
        template: 'loginMfa',
        personalisation: {
          name: userRecord.firstName,
          verificationCode: token
        }
      }
      app.mailservice.send(emailTemplate, function(error) {
        if (error) {
          logger.log('error', error.message)
        }
        logger.log('info', 'Verification code for ' + user.email);
      });

      // Success
      return next(null, userRecord);
    });
  });
};

// module exports
exports = module.exports = LocalAuth;
