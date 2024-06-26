// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Backbone = require('backbone');
  var Helpers = require('core/helpers');
  var PasswordHelpers = require('plugins/passwordChange/passwordHelpers');
  var Origin = require('core/origin');
  var _ = require('underscore');

  var UserProfileModel = Backbone.Model.extend({

    idAttribute: '_id',
    url: 'api/user/me',

    validate: function (attributes, options) {
      var validationErrors = {};

      if (!attributes.firstName) {
        validationErrors.firstName = Origin.l10n.t('app.validationrequired');
      }

      if (!attributes.lastName) {
        validationErrors.lastName = Origin.l10n.t('app.validationrequired');
      }

      if (!attributes.email) {
        validationErrors.email = Origin.l10n.t('app.validationrequired');
      } else if (!Helpers.isValidEmail(attributes.email)) {
        validationErrors.email = Origin.l10n.t('app.invalidusernameoremail');
      }

      if (attributes._isNewPassword) {
        if (PasswordHelpers.validatePassword(attributes.password).length > 0 || !attributes.password) {
          validationErrors.password = `${Origin.l10n.t('app.passwordindicatormedium')}`;
        }
        if (!PasswordHelpers.validateConfirmationPassword(attributes.password, attributes.confirmPassword)){
          validationErrors.confirmPassword = `${Origin.l10n.t('app.confirmpasswordnotmatch')}`;
        }
      }

      return _.isEmpty(validationErrors) 
      ? null
      : validationErrors;
    }

  });

  return UserProfileModel;

});