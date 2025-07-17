// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require){
  var OriginView = require('core/views/originView');
  var Origin = require('core/origin');

  var NavigationView = OriginView.extend({
    tagName: 'nav',
    className: 'navigation',

    initialize: function() {
      this.listenTo(Origin, 'login:changed', this.loginChanged);
      this.render();
    },

    events: {
      'click a.navigation-item':'onNavigationItemClicked',
      'click .profile-dropbtn':'toggleProfileDropdown',
      'blur .profile-dropdown-menu':'onDropdownBlur'
    },

    render: function() {
      this.model.set('userInitials', 'NA');
      var that = this;
      if (Origin.sessionModel && Origin.sessionModel.get('isAuthenticated')) {
        $.ajax({
          url: 'api/user/me',
          method: 'GET',
          async: false,
          error: function(error) {
            console.log('error user me:', error);
          },
          success: function(result){
            if (result && result.firstName && result.lastName) {
              var firstInitial = (result['firstName'])[0].toUpperCase();
              var lastInitial = (result['lastName'])[0].toUpperCase();
              that.model.set('userFullName', `${result['firstName']} ${result['lastName']}`)
              that.model.set('userInitials', firstInitial + lastInitial);
            }
          }
        });
      }
      var data = this.model ? this.model.toJSON() : null;
      var template = Handlebars.templates[this.constructor.template];
      this.$el.html(template(data));
      return this;
    },

    loginChanged: function() {
      this.render();
    },

    onNavigationItemClicked: function(event) {
      event.preventDefault();
      event.stopPropagation();
      this.hideProfileDropdown();
      Origin.trigger('navigation:' + $(event.currentTarget).attr('data-event'));
    },

    onDropdownBlur: function(event){
      var parent = $(event.relatedTarget).parents('.profile-dropdown-menu')
      if(parent && parent.length === 0){
        this.hideProfileDropdown();
      }
    },

    toggleProfileDropdown: function(event){
      if($(event.currentTarget).attr('aria-expanded') === 'true'){
        this.hideProfileDropdown();
      } else {
        this.showProfileDropdown();
      }
    },

    showProfileDropdown: function () {
      this.$el.find("#profile-dropdown").show();
      Origin.trigger('startkeyboardtrap', {$el: this.$el.find(".profile-dropdown-menu")});
      this.$el.find('.profile-dropbtn').attr('aria-expanded', "true");
    },

    hideProfileDropdown: function () {
      Origin.trigger('stopkeyboardtrap', {$el: this.$el.find(".profile-dropdown-menu")});
      this.$el.find("#profile-dropdown").hide();
      this.$el.find('.profile-dropbtn').attr('aria-expanded', "false")
    }
  }, {
    template: 'navigation'
  });

  return NavigationView;
});
