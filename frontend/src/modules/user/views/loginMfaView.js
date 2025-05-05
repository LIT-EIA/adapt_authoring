// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Backbone = require('backbone');
  var Origin = require('core/origin');
  var OriginView = require('core/views/originView');
  var Helpers = require('core/helpers');


  var LoginMfaView = OriginView.extend({

    className: 'login login-mfa',

    tagName: "div",

    events: {
      'keydown #login-mfa-input-verificationcode': 'clearErrorStyling',
      'click .login-mfa-form-submit': 'submitLoginDetails',
      'click button.cancel': 'goToLogin',
      'click button.dash': 'goHome',
      'click button.resend-mfatoken-btn': 'resendLoginMfaToken'
    },

    preRender: function () {
      this.listenTo(Origin, 'login:failed', this.loginFailed, this);
      var email = this.model.get('email');
      this.model.set('mfaText', Origin.l10n.t('app.checkemail', { email: email }))
    },

    postRender: function () {
      this.setViewToReady();
      Origin.trigger('login:loaded');
    },

    goToLogin: function (e) {
      e && e.preventDefault();
      Origin.router.navigateToLogin();
    },

    goHome: function (e) {
      e && e.preventDefault();
      Origin.router.navigateToHome();
    },

    handleEnterKey: function (e) {
      var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;

      if (key == 13) {
        e.preventDefault();
        this.submitLoginDetails();
      }
    },

    clearErrorStyling: function (e) {
      $('#login-input-username').removeClass('input-error');
      $('#loginError').addClass('display-none');

      this.handleEnterKey(e);
    },

    submitLoginDetails: function (e) {
      e && e.preventDefault();

      var inputVerificationCode = $.trim(this.$("#login-mfa-input-verificationcode").val());
      var shouldSkipMfa = this.$('#skip-mfa').prop('checked');

      // Validation
      if (inputVerificationCode === '') {
        this.loginFailed('invalidMfaToken');
        return false;
      } else {
        $('#login-mfa-input-verificationcode').removeClass('input-error');
      }

      var userModel = this.model;

      userModel.verifyCode(inputVerificationCode, shouldSkipMfa);
    },

    resendLoginMfaToken: function (e) {
      e && e.preventDefault();

      var resendCodeString = Helpers.translateKey('app.resendverificationcode');
      var sendingCodeString = Helpers.translateKey('app.sending');
      var checkmark = '&#10003;';

      var returnToDefault = function () {
        button.hide().html(resendCodeString).fadeIn('fast');
      }

      var button = $(e.target);
      button.hide().html(`${sendingCodeString} <span class="loading-spinner"></span>`).fadeIn('fast');
      var userModel = this.model;
      userModel.resendLoginMfaToken(function (status) {
        if (status === 'success') {
          setTimeout(function () {
            button.html(`${sendingCodeString} ${checkmark}`);
            setTimeout(function () {
              returnToDefault();
            }, 500);
          }, 1000);
        } else {
          button.attr('disabled', true);
          returnToDefault();
        }
      });
    },

    loginFailed: function (errorCode) {
      if (errorCode === 'invalidMfaToken') {
        var errorMessage = Origin.l10n.t('app.invalidverificationcode');
      } else if (errorCode === 'failedMfaCount') {
        var errorMessage = Origin.l10n.t('app.failedmfacount');
        var button = $('.resend-mfatoken-btn');
        button.attr('disabled', true);
      } else if (errorCode === 'mfaResetCount') {
        var errorMessage = Origin.l10n.t('app.mfaresetcount');
      }

      $('#login-mfa-input-verificationcode').addClass('input-error');
      $('#loginErrorMessage').text(errorMessage);
      $('#loginError').removeClass('display-none');
    }

  }, {
    ERR_INVALID_CREDENTIALS: 1,
    ERR_ACCOUNT_LOCKED: 2,
    ERR_MISSING_FIELDS: 3,
    ERR_TENANT_DISABLED: 4,
    ERR_ACCOUNT_INACTIVE: 5,
    template: 'loginMfa'
  });

  return LoginMfaView;

});
