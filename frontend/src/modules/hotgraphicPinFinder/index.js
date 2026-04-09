// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Origin = require('core/origin');
  var HotgraphicPinFinderModalView = require('./views/hotgraphicPinFinderModalView');

  Origin.on('hotgraphicpinfinder:open', function(data){
    var HotgraphicPinFinderModel = Backbone.Model.extend({
      defaults: data
    });
    var model = new HotgraphicPinFinderModel();
    $('.module-editor').append(new HotgraphicPinFinderModalView({ model: model }).$el);
  });
});
