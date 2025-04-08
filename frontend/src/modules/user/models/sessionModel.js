// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(['require', 'backbone', 'core/origin'], function(require, Backbone, Origin) {
  var SessionModel = Backbone.Model.extend({
    url: "api/authcheck",
    defaults: {
      id: '',
      tenantId: '',
      email: '',
      isAuthenticated: false,
      permissions: [],
      otherLoginLinks: []
    },

    initialize: function() {
    },

    login: function (username, password, shouldPersist) {
      var postData = {
        email: username,
        password: password,
        shouldPersist: shouldPersist
      };
      $.post('api/login', postData, _.bind(function (jqXHR, textStatus, errorThrown) {
        this.set({
          id: jqXHR.id,
          tenantId: jqXHR.tenantId,
          email: jqXHR.email,
          firstName: jqXHR.firstName,
          lastName: jqXHR.lastName,
          isAuthenticated: jqXHR && jqXHR.requireMfa !== true ? true : false,
          permissions: jqXHR.permissions
        });

        if (jqXHR && jqXHR.requireMfa !== true) {
          Origin.trigger('login:changed');
          Origin.trigger('schemas:loadData', Origin.router.navigateToHome);
        }
        else {
          Origin.trigger('schemas:loadData', Origin.router.navigateToLoginMfaPage);
        }
      }, this)).fail(function(jqXHR, textStatus, errorThrown) {
        Origin.trigger('login:failed', (jqXHR.responseJSON && jqXHR.responseJSON.errorCode) || 1);
      });
    },

    verifyCode: function(code, shouldSkipMfa) {
      var postData = {
        email: this.get('email'),
        token: code,
        shouldSkipMfa: shouldSkipMfa
      };

      $.post('api/loginMfa', postData, _.bind(function (jqXHR, textStatus, errorThrown) {
        this.set({
          validationDate: jqXHR.validationDate,
          isAuthenticated: true
        });
        Origin.trigger('login:changed');
        Origin.trigger('schemas:loadData', Origin.router.navigateToHome);
      }, this)).fail(function(jqXHR, textStatus, errorThrown) {
        Origin.trigger('login:failed', (jqXHR.responseJSON && jqXHR.responseJSON.errorCode) || 1);
      });
    },

    resendLoginMfaToken: function() {
      var postData = {
        email: this.get('email')
      };
      $.post('api/newLoginMfaToken', postData, _.bind(function (jqXHR, textStatus, errorThrown) {
        Origin.trigger('schemas:loadData', Origin.router.navigateToLoginMfaPage);
      }, this)).fail(function(jqXHR, textStatus, errorThrown) {
        console.log('failed jqXHR: ', jqXHR);
      });
    },

    logout: function () {
      $.post('api/logout', _.bind(function() {
        // revert to the defaults
        this.set(this.defaults);
        Origin.trigger('login:changed');
        Origin.router.navigateToLogin();
      }, this));
    },
  });

  return SessionModel;
});
