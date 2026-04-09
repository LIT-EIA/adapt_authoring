define(['core/origin', './views/navigationView'], function(Origin, NavigationView) {
  Origin.once('origin:dataReady', function() {
    $('#navigation_container').replaceWith(new NavigationView({ model: Origin.sessionModel }).$el);
  });
});
