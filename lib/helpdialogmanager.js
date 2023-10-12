// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
var _ = require('underscore');
var async = require('async');
var util = require('util');
var usermanager = require('./usermanager');
var permissions = require('./permissions');

var configuration = require('./configuration');
var database = require('./database');

/*
 * CONSTANTS
 */
function DuplicateHelpDialogError (help_dialog) {
  this.name = 'DuplicateHelpDialogError';
  this.help_dialog = help_dialog || 'A help dialog already exist for this name';
}

exports = module.exports = {
  /**
   * gets the currently logged in help_dialogs from session
   */
  getMasterHelpDialogs: function () {
    try { // parse the session help_dialogs to give us a plain object without ObjectIds
      return 'help_dialog'
    } catch(e) {
      return false;
    }
  },
  createMasterHelpDialog: function (options, next) {

    if ('function' === typeof options) {
      next = options;
      options = {};
    }

    var user = usermanager.getCurrentUser();

    var data = {
      name: 'help_dialog',
      helpDialogEnabled: false,
      helpDialogEN: '',
      helpDialogFR: '',
      properties: {
        _businessLines: null,
        name: 'help_dialog'
      },
      createdBy: user._id
    };
    database.getDatabase(function(err,db) {
      if (err) {
        return next(err);
      }

      // set creation date
      if (!data.createdAt) {
        data.createdAt = new Date();
      }

      db.create('message', data, function (err, result) {
        if (err) {
          return next(err);
        }

        permissions.createPolicy(user._id, function (err, policy) {
          if (err) {
            logger.log('error', 'there was an error granting permissions', err);
          }

          var resource = permissions.buildResourceString(user._tenantId, '/api/help_dialogs/*');
          permissions.addStatement(policy, ['create'], resource, 'allow', function (err) {
            if (err) {
              logger.log('error', 'there was an error granting permissions', err);
            }
            return next(null, result);
          });
        });
      });
    }, configuration.getConfig('dbName'));
  },
  retrieveHelpDialogs: function (search, options, callback) {
    // shuffle params
    if ('function' === typeof options) {
      callback = options;
      options = {};
    }

    database.getDatabase(function(err,db) {
      db.retrieve('message', search, options, function (error, results) {
        if (error) {
          return callback(error);
        }

        if (results && results.length > 0) {
          if (results.length === 1) {
            // we only want to retrieve a single help dialogs, so we send an error if we get multiples
            return callback(null, results[0]);
          }

          return callback(new Error('expected a single result but returned ' + results.length + ' results'));
        }

        return callback(null, false);
      });
    }, configuration.getConfig('dbName'));
  },

  /**
   * updates a single help_dialogs
   *
   * @param {object} search - fields to match
   * @param {object} update - fields to change and their values
   * @param {function} callback - function of the form function (error, help_dialogs)
   */
  updateHelpDialogs: function (search, update, callback) {
    var self = this;
    // only execute if we have a single matching record
    this.retrieveHelpDialogs(search, function (error, result) {
      if (error) {
        return callback(error);
      }
      if (!result) {
        return callback(new Error('No matching help dialogs record found'));
      }
      database.getDatabase(function(err, db) {
          db.retrieve('message', { name: self.getMasterHelpDialogs() }, function (error, results) {
            if (error) {
              return callback(error);
            }
            if (results && results.length > 1) {
              return callback(new DuplicateHelpDialogError());
            }
            db.update('message', search, update, callback);
          });
      }, configuration.getConfig('dbName'));
    });
  },

  init: function (app) {
    var self = this;
    var rest = require('./rest');

    rest.get('/helpdialogs', function (req, res, next) {
      var masterHelpDialogs = self.getMasterHelpDialogs();

      if (masterHelpDialogs) {
        self.retrieveHelpDialogs({'name': masterHelpDialogs}, function (err, results) {
          if (err) {
            res.statusCode = 500;
            return res.json(err);
          }
          if (results) {
            // todo - check if it is really necessary to use toObject()
            var data = results.toObject();
            return res.json(data);
          }
          else {
            self.createMasterHelpDialog(function (createError, result) {
              if (createError) {
                logger.log('error', createError);
                res.statusCode = 500;
                return res.json(createError);
              }
              var data = result.toObject();
              return res.json(data);
            });
          }
        });
      } else {
        res.statusCode = 400;
        return res.json(false);
      }
    });

    rest.put('/helpdialogs', function (req, res, next) {
      var help_dialogs = self.getMasterHelpDialogs();
      var delta = req.body;
      if (delta.properties) delta.properties = JSON.parse(delta.properties);

      if (!delta || 'object' !== typeof delta) {
        return res.status(400).json({success: false, message: 'request body was not a valid object'});
      }

      if (!help_dialogs) {
        return res.status(400).json(false);
      }
      
      self.updateHelpDialogs({'name': help_dialogs}, delta, function(err) {
        if (err) {
          return next(err);
        }

        return res.status(200).json({success:true});
      });
    });

  }
};
