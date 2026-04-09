// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Origin = require('core/origin');
  var Helpers = require('core/helpers');

  var MessageManagementView = require('./views/messageManagementView');
  var MessageManagementGeneralRibbonView = require('./views/messageManagementGeneralRibbonView');
  var MessageManagementSidebarView = require('./views/messageManagementSidebarView');
  var MessageManagementModel = require('./models/messageManagementModel');

  var isReady = false;
  var dateTime = Date.now();
  var TEN_MINUTES = 10 * 60 * 1000;
  var data = {
    featurePermissions: ["{{tenantid}}/messages/*:create", "{{tenantid}}/messages/*:read", "{{tenantid}}/messages/*:update"]
  };

  Origin.on('location:change', function(){
    if(((new Date) - dateTime) > TEN_MINUTES){
      dateTime = Date.now();
      var messages = new MessageManagementModel();
      messages.fetch({
        success: function () {
          if (messages.attributes.generalRibbonEnabled) {
            messages.attributes.generalRibbon = $('html').attr('lang') === 'en' ? messages.attributes.generalRibbonEN : messages.attributes.generalRibbonFR;
            if($('.general-ribbon').length !== 0){
              $('.general-ribbon').html(new MessageManagementGeneralRibbonView({ model: messages }).$el)
            } else {
              $('.navigation').before(new MessageManagementGeneralRibbonView({ model: messages }).$el);
            }
          } else {
              $('.general-ribbon').remove();
          }
        }
      });
    }
  })

  Origin.on('origin:dataReady login:changed messageManagementSidebar:views:saved', function () {
    var messages = new MessageManagementModel();
    messages.fetch({
      success: function () {
        if (messages.attributes.generalRibbonEnabled) {
          messages.attributes.generalRibbon = $('html').attr('lang') === 'en' ? messages.attributes.generalRibbonEN : messages.attributes.generalRibbonFR;
          if($('.general-ribbon').length !== 0){
            $('.general-ribbon').html(new MessageManagementGeneralRibbonView({ model: messages }).$el)
          } else {
            $('.navigation').before(new MessageManagementGeneralRibbonView({ model: messages }).$el);
          }
        } else {
            $('.general-ribbon').remove();
        }
      }
    });
  });

  Origin.on('origin:dataReady login:changed', function () {
    Origin.permissions.addRoute('messageManagement', data.featurePermissions);
    if (Origin.permissions.hasPermissions(data.featurePermissions)) {
      Origin.globalMenu.addItem({
        "location": "global",
        "text": Origin.l10n.t('app.messagemanagement'),
        "icon": "fa-comment",
        "sortOrder": 4,
        "callbackEvent": "messageManagement:open"
      });
    } else {
      isReady = true;
    }
  });

  Origin.on('globalMenu:messageManagement:open', function () {
    Origin.router.navigateTo('messageManagement');
  });

  Origin.on('router:messageManagement', function () {
    if (Origin.permissions.hasPermissions(data.featurePermissions)) {
      if (isReady) {
        return onRoute();
      } else {
        onRoute();
      }
    }
  });

  var onRoute = function () {
    Origin.trigger('location:title:update', { title: Origin.l10n.t('app.message.title') });
    var messages = new MessageManagementModel();
    messages.fetch({
      success: function () {
        Origin.sidebar.addView(new MessageManagementSidebarView().$el);
        Origin.contentPane.setView(MessageManagementView, { model: messages });
      }
    });
    return
  };
})
