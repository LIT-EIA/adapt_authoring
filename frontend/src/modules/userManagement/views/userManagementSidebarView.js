define([
  'core/origin',
  'modules/sidebar/views/sidebarItemView',
  './filterView'
], function(Origin, SidebarItemView, FilterView) {

  var UserManagementSidebarView = SidebarItemView.extend({

    events: {
      'click button.add': 'addUser',
      'click button.export': 'exportEmails'
    },

    initialize: function() {
      SidebarItemView.prototype.initialize.apply(this, arguments);
    },

    postRender: function() {
      this.filterView = new FilterView({
        collection: this.collection,
        model: this.model
      });
    },

    addUser: function(event) {
      event && event.preventDefault();
      Origin.router.navigateTo('userManagement/addUser');
    },
    exportEmails: function(event) {
      event && event.preventDefault();
      Origin.trigger('userManagement:exportEmails', event);
    }

  }, {
    template: 'userManagementSidebar'
  });

  return UserManagementSidebarView;

});
