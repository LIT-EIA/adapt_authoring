// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {

  var Origin = require('core/origin');
  var SidebarItemView = require('modules/sidebar/views/sidebarItemView');
  var Backbone = require('backbone');

  var AnalyticsSidebarView = SidebarItemView.extend({

    events: {
        'click .analytics-edit-sidebar-save'   : 'save',
        'click .analytics-edit-sidebar-cancel' : 'cancel'
    },

    cancel: function(event) {
        event.preventDefault();
        Backbone.history.history.back();
    }

  }, {
      template: 'analyticsSidebar'
  });

  return AnalyticsSidebarView;

});
