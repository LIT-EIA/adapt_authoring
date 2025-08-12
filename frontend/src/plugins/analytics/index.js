// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Origin = require('core/origin');
  var Helpers = require('core/helpers');

  var AnalyticsView = require('./views/analyticsView');
  var AnalyticsSidebarView = require('./views/analyticsSidebarView');
  var AnalyticsModel = require('./models/analyticsModel');

  var isReady = false;
  var data = {
    featurePermissions: ["{{tenantid}}/messages/*:create", "{{tenantid}}/messages/*:read", "{{tenantid}}/messages/*:update"]
  };

  Origin.on('origin:dataReady login:changed analyticsSidebar:views:saved', function () {
    var messages = new AnalyticsModel();
    messages.fetch({
      success: function () {
        console.log(messages)
      }
    });
  });

  Origin.on('origin:dataReady login:changed', function () {
    Origin.permissions.addRoute('analytics', data.featurePermissions);
    if (Origin.permissions.hasPermissions(data.featurePermissions)) {
      Origin.globalMenu.addItem({
        "location": "global",
        "text": Origin.l10n.t('app.analytics'),
        "icon": "fa-bar-chart",
        "sortOrder": 4,
        "callbackEvent": "analytics:open"
      });
    } else {
      isReady = true;
    }
  });

  Origin.on('globalMenu:analytics:open', function () {
    Origin.router.navigateTo('analytics');
  });

  Origin.on('router:analytics', function () {
    if (Origin.permissions.hasPermissions(data.featurePermissions)) {
      if (isReady) {
        return onRoute();
      } else {
        onRoute();
      }
    }
  });

  var onRoute = function () {
    Origin.trigger('location:title:update', { title: Origin.l10n.t('app.analytics.title') });
    var messages = new AnalyticsModel();
    messages.fetch({
      success: function () {
        Origin.sidebar.addView(new AnalyticsSidebarView().$el);
        Origin.contentPane.setView(AnalyticsView, { model: messages });
      }
    });
    return
  };
})
