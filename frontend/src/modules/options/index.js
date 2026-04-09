// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Origin = require('core/origin');
  var OptionsView = require('./views/optionsView');
  var OptionsDropdownView = require('./views/optionsDropdownView');


  var Options = {
    addItems: function(items) {
      var collection = new Backbone.Collection(items);
      $('.location-options').append(new OptionsView({ collection: collection }).$el);
      $('.location-options').append(new OptionsDropdownView({ collection: collection }).$el);
    }
  };

  Origin.options = Options;
});
