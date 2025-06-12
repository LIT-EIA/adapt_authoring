// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require){
  var Origin = require('core/origin');
  var OriginView = require('core/views/originView');
  var Helpers = require('core/helpers');
  var UserModel = require('../models/userModel');
  var UserView = require('../views/userView');

  var UserManagementView = OriginView.extend({
    className: 'userManagement',
    settings: {
      autoRender: false
    },
    users: null,
    views: [],
    selectedView: null,
    showFilterScreen: false,

    events: {
      'click button.refresh-all': 'refreshUserViews',
      'click button[data-sort]': 'onSortClick'
    },

    initialize: function() {
      OriginView.prototype.initialize.apply(this, arguments);
      this.users = this.collection;

      this.listenTo(this.users, 'sort', function(a,b,c) {
        this.removeChildViews();
        this.renderChildViews();
      });

      this.listenTo(Origin, {
        'userManagement:exportEmails' : this.exportEmails 
      })

      Origin.trigger('location:title:update', { title: Origin.l10n.t('app.usermanagementtitle') });
      this.initData();
      this.render();
    },

    initData: function() {
      this.listenTo(this.users, {
        'sync': this.onDataFetched
      });
    },

    render: function() {
      this.removeChildViews();
      OriginView.prototype.render.apply(this, arguments);
      this.renderChildViews();
    },

    exportEmails: function() {
      var emailList = '';
      var users = this.users.models;
      users.forEach(function(user){
        if(!user.get('_isHidden')){
          emailList += user.get('email') + ';';
        }
      });
      const blob = new Blob([emailList], { type: 'text/plain;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `adapt-emails-${Date.now()}.txt`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    renderChildViews: function() {
      var fragment = document.createDocumentFragment();
      this.users.each(function(user) {
        user.set('globalData', this.model.get('globalData'));
        var userView = new UserView({model: user});
        fragment.appendChild(userView.el);
        this.views.push(userView);

        if(this.selectedView && user.get('_id') === this.selectedView) {
          userView.$el.addClass('selected').click();
        }

      }, this);
      this.$('.users').append(fragment);
    },

    removeChildViews: function() {
      if(this.views.length) {
        for(var i = 0, count = this.views.length; i < count; i++) {
          var view = this.views[i];
          if (view.isSelected) this.selectedView = view.model.get('_id');
          view.remove();
        }
        this.views = [];
      }
    },

    postRender: function() {
      this.setViewToReady();
      this.$('.users').fadeIn(300);
    },

    onSortClick: function(event) {
      var $elm = $(event.currentTarget);
      var sortBy = $elm.data('sort');
      var sortAscending = $elm.hasClass('sort-down');

      if ($elm.hasClass('active')) {
        sortAscending = !sortAscending;
      }

      this.$('.sort').removeClass('active sort-up').addClass('sort-down');
      $elm.addClass('active');

      $elm.toggleClass('sort-down', sortAscending);
      $elm.toggleClass('sort-up', !sortAscending);

      this.users.sortBy = sortBy;
      this.users.direction = (sortAscending) ? 1 : -1;
      this.users.sortCollection();
    },

    refreshUserViews: function(event) {
      event && event.preventDefault();
      this.users.fetch();
    },

    onDataFetched: function(models, reponse, options) {
      this.render();
    }

  }, {
    template: 'userManagement'
  });

  return UserManagementView;
});
