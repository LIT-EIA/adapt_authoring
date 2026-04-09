// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Origin = require('core/origin');
  var SimulationZoneFinderModalView = require('./views/simulationZoneFinderModalView');

  Origin.on('simulationzonefinder:open', function(data){
    var SimulationZoneFinderModel = Backbone.Model.extend({
      defaults: data
    });
    var model = new SimulationZoneFinderModel();
    $('.module-editor').append(new SimulationZoneFinderModalView({ model: model }).$el);
  });
});
