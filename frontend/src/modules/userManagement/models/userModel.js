// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Backbone = require('backbone');
  var Origin = require('core/origin');

  var UserModel = Backbone.Model.extend({
    idAttribute: '_id',

    url: function () {
      var root = 'api/user';
      return root + ((this.isNew()) ? '' : '/' + this.id);
    },

    initialize: function () {
      this.on('change:globalData', this.onGlobalDataChanged);
      this.on('change:roles', this.setRoleNames);
      this.on('change:_tenantId', this.setTenantName);
      this.on('change:_isDeleted', this.setAccountStatus);
      this.on('change:failedLoginCount', this.setAccountStatus);
      this.on('change:passwordResetCount', this.setAccountStatus);
      this.on('change:mfaResetCount', this.setAccountStatus);
      this.on('change:failedMfaCount', this.setAccountStatus);
      this.setAccountStatus();
    },

    onGlobalDataChanged: function (model, value, options) {
      this.setRoleNames(model, model.get('roles'), options);
      this.setTenantName(model, model.get('_tenantId'), options);
      this.setAccountStatus(model);
    },

    // pull the human-readable role names from the list of all roles
    setRoleNames: function (model, value, options) {
      if (!model.get('globalData')) {
        return;
      }
      var roleNames;
      if (typeof value === 'object') { // array
        roleNames = value.map(function (role, index) {
          var id = role._id || role;
          return model.get('globalData').allRoles.findWhere({ _id: id }).get('name');
        });
      } else { // string
        roleNames = model.get('globalData').allRoles.findWhere({ _id: value }).get('name');
      }
      model.set('roleNames', roleNames);
    },

    // pull the human-readable tenant name from the list of all tenants
    setTenantName: function (model, value, options) {
      var tenantId = model.get('_tenantId');
      if (!tenantId) return;

      var tenantName;
      if (typeof tenantId === 'string') {
        tenantName = model.get('globalData').allTenants.findWhere({ _id: tenantId }).get('displayName');
      } else if (tenantId.hasOwnProperty('displayName')) {
        tenantName = tenantId.displayName;
      } else {
        tenantName = model.get('globalData').allTenants.findWhere({ _id: tenantId._id }).get('displayName');
      }

      model.set('tenantName', tenantName);
    },

    setAccountStatus: function () {
      var model = this;
      var passwordLocked = model.get('failedLoginCount') >= Origin.constants.maxLoginAttempts;
      var mfaLocked = model.get('failedMfaCount') >= Origin.constants.maxLoginAttempts;
      var mfaMailLocked = model.get('mfaResetCount') >= Origin.constants.maxLoginAttempts;
      var passwordMailLocked = model.get('passwordResetCount') >= Origin.constants.maxLoginAttempts;
      var disabled = model.get('_isDeleted');

      if (disabled) {
        model.set('accountStatus', 'Disabled');
      } else if (passwordLocked) {
        model.set('accountStatus', 'Locked');
      } else if (mfaLocked) {
        model.set('accountStatus', 'Mfa Locked');
      } else if (passwordMailLocked) {
        model.set('accountStatus', 'Password Mail Locked');
      } else if (mfaMailLocked) {
        model.set('accountStatus', 'Mfa Mail Locked');
      } else {
        model.set('accountStatus', 'Active');
      }

      this.setLockStatus(model);
    },

    setLockStatus: function (model, value, options) {
      var status = model.get('accountStatus');
      this.set('_isLocked', status !== 'Active');
    }
  });

  return UserModel;
});
