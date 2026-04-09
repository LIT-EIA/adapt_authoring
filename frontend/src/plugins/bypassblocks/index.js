// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Origin = require('core/origin');
  var Helpers = require('core/helpers');
  var BypassBlockView = require('./views/bypassBlockView');

  Origin.on('origin:dataReady login:changed location:title:update', function() {
    $('.bypass-block-content').remove();
    $('.general-ribbon').show();
    var bypassBlockView = new BypassBlockView().$el;
    var bypassBlockTopHeight = $('.general-ribbon').length > 0 ? $('.general-ribbon').height() + 13 : 13
    bypassBlockView.find('.bypass-block-btn').css('top', `${bypassBlockTopHeight}px`);
    var beforeEl = $('.general-ribbon').length > 0 ? $('.general-ribbon') : $('.navigation');
    beforeEl.before(
      bypassBlockView
    );
  });
})
