// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Origin = require('core/origin');
  var Helpers = require('core/helpers');

  var HelpDialogManagementView = require('./views/helpDialogManagementView');
  var HelpDialogManagementSidebarView = require('./views/helpDialogManagementSidebarView');
  var HelpDialogManagementModel = require('./models/helpDialogManagementModel');
  var HelpDialogView = require('./views/helpDialogView');

  var isReady = false;
  var dateTime = Date.now();
  var TEN_MINUTES = 10 * 60 * 1000;
  var data = {
    featurePermissions: ["{{tenantid}}/helpdialogs/*:create", "{{tenantid}}/helpdialogs/*:read", "{{tenantid}}/helpdialogs/*:update"]
  };

  Origin.on('origin:dataReady login:changed', function () {
    Origin.permissions.addRoute('helpDialogManagement', data.featurePermissions);
    if (Origin.permissions.hasPermissions(data.featurePermissions)) {
      Origin.globalMenu.addItem({
        "location": "global",
        "text": Origin.l10n.t('app.helpdialogmanagement'),
        "icon": "fa-question-circle",
        "sortOrder": 5,
        "callbackEvent": "helpDialogManagement:open"
      });
    } else {
      isReady = true;
    }
  });

  Origin.on('globalMenu:helpDialogManagement:open', function () {
    Origin.router.navigateTo('helpDialogManagement');
  });

  Origin.on('router:helpDialogManagement', function () {
    if (Origin.permissions.hasPermissions(data.featurePermissions)) {
      if (isReady) {
        return onRoute();
      } else {
        onRoute();
      }
    }
  });

  var onRoute = function () {
    Origin.trigger('location:title:update', { title: Origin.l10n.t('app.helpdialogmanagement') });
    var helpDialogs = new HelpDialogManagementModel();
    helpDialogs.fetch({
      success: function (model) {
        var form = new Backbone.Form({
          model: model
        }).render();

        Origin.scaffold.setModel(model);
        Origin.sidebar.addView(new HelpDialogManagementSidebarView().$el);
        Origin.contentPane.setView(HelpDialogManagementView, { model: helpDialogs, form: form });
      }
    });
    return
  };

  var helpDialogManagementModel = new HelpDialogManagementModel();
  Origin.on('origin:dataReady login:changed helpDialogManagementSidebar:views:saved', function() {
    helpDialogManagementModel.fetch({
      success: function(result) {
        $('.help-dialog').remove();
        $('body').append(new HelpDialogView({ model: result }).$el);
      }
    })
  });
})
