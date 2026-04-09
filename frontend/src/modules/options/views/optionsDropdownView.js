// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Origin = require('core/origin');
  var Backbone = require('backbone');

  var OptionsView = Backbone.View.extend({
    className: 'options-dropdown',

    events: {
    'click .option-value-item button': 'onOptionClicked',
    'click .options-dropbtn':'toggleOptionsDropdown',
    'blur .options-dropdown-menu':'onDropdownBlur'
    },

    initialize: function() {
      this.eventsToTrigger = [];

      this.listenTo(Origin, {
        'remove:views': this.remove,
        'options:update:ui': this.updateUI,
        'options:reset:ui': this.resetUI
      });
      this.render();
    },

    render: function() {
      var template = Handlebars.templates[this.constructor.template];
      this.$el.html(template());
      _.defer(_.bind(this.postRender, this));
      return this;
    },

    renderOptions: function() {
      var template = Handlebars.templates['optionsItem'];
      // Go through each item and check if it has a group
      // If it does - render into that group
      this.collection.each(function(item) {
        if (_.indexOf(this.eventsToTrigger, item.get('callbackEvent')) > -1) {
          item.set('selected', true);
        }
        var itemGroup = item.get('group')
        var parentSelector = (itemGroup) ? '.options-dropdown-group-' + itemGroup : '.options-inner';
        $(parentSelector).append(template(item.toJSON()));
      }, this);
    },

    postRender: function() {
      this.sortAndRenderGroups();
      // Add a defer to make sure the groups are rendered
      _.defer(_.bind(this.renderOptions, this));
    },

    updateUI: function(userPreferences) {
      // set selected preferences
      _.defer(_.bind(function() {
        _.each(userPreferences, function(preference) {
          if (_.isArray(preference)) return;
          this.$('button.option-value-' + preference).addClass('selected');
        }, this);
      }, this));
    },

    resetUI: function(group) {
      _.defer(_.bind(function() {
        this.$('button[data-group="'+group+'"]').removeClass('selected');
      }, this));
    },

    sortAndRenderGroups: function() {
      var availableGroups = _.uniq(this.collection.pluck('group'));
      var template = Handlebars.templates['optionsDropdownGroup'];
      _.each(availableGroups, function(group) {
        this.$('.options-inner-dropdown').append(template({ group: group }));
      });
    },

    setSelectedOption: function(selectedOption) {
      var group = selectedOption.attr('data-group');
      if(group) {
        this.$('.options-dropdown-group-' + group + ' button').removeClass('selected');
        selectedOption.addClass('selected');
      }
      var callbackEvent = selectedOption.attr('data-callback');
      if(callbackEvent) {
        Origin.trigger(callbackEvent);
      }
    },

    onOptionClicked: function(event) {
      event && event.preventDefault();
      this.setSelectedOption($(event.currentTarget));
      this.hideOptionsDropdown();
    },

    toggleOptionsDropdown: function(event){
      if($(event.currentTarget).attr('aria-expanded') === 'true'){
        this.hideOptionsDropdown();
      } else {
        this.showOptionsDropdown();
      }
    },

    showOptionsDropdown: function () {
      this.$el.find("#options-dropdown").show();
      Origin.trigger('startkeyboardtrap', this);
      this.$el.find('.options-dropbtn').attr('aria-expanded', "true");
    },

    hideOptionsDropdown: function () {
      Origin.trigger('stopkeyboardtrap', this);
      this.$el.find("#options-dropdown").hide();
      this.$el.find('.options-dropbtn').attr('aria-expanded', "false")
    },

    onDropdownBlur: function(event){
      var parent = $(event.relatedTarget).parents('.options-dropdown-menu')
      if(parent && parent.length === 0){
        this.hideOptionsDropdown();
      }
    },
  }, {
    template: 'optionsDropdown'
  });

  return OptionsView;
});
