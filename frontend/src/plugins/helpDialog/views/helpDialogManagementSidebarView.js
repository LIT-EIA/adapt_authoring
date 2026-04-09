// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {

  var Origin = require('core/origin');
  var SidebarItemView = require('modules/sidebar/views/sidebarItemView');
  var Backbone = require('backbone');

  var HelpDialogManagementSidebarView = SidebarItemView.extend({

    events: {
      'click .help-dialog-management-edit-sidebar-save': 'save',
      'click .help-dialog-management-edit-sidebar-cancel': 'cancel'
    },

    save: function (event) {
      event.preventDefault();
      this.updateButton('.help-dialog-management-edit-sidebar-save', Origin.l10n.t('app.saving'));
      Origin.trigger('helpDialogManagementSidebar:views:save');
    },

    cancel: function (event) {
      event.preventDefault();
      Backbone.history.history.back();
    }

  }, {
    template: 'helpDialogManagementSidebar'
  });

  return HelpDialogManagementSidebarView;

});
