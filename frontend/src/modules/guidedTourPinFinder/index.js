// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Origin = require('core/origin');
  var GuidedTourPinFinderModalView = require('./views/guidedTourPinFinderModalView');

  Origin.on('guidedtourpinfinder:open', function(data){
    var GuidedTourPinFinderModel = Backbone.Model.extend({
      defaults: data
    });
    var model = new GuidedTourPinFinderModel();
    $('.module-editor').append(new GuidedTourPinFinderModalView({ model: model }).$el);
  });



});
