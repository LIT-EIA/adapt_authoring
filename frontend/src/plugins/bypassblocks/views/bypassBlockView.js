// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require){
  var OriginView = require('core/views/originView');
  var Origin = require('core/origin');

  var BypassBlockView = OriginView.extend({
    tagName: 'div',
    className: 'bypass-block-content',

    initialize: function() {
      this.render();
    },

    events: {
      'click .button--skip-link': 'skipToLink'
    },

    render: function(data) {
      var template = Handlebars.templates[this.constructor.template];
      var showSkipToHelpDialog = !String(window.location).includes('user/login');
      this.$el.html(template({showSkipToHelpDialog: showSkipToHelpDialog}));
      _.defer(_.bind(this.postRender, this));
      return this;
    },

    skipToLink: function(e) {
      e.preventDefault();
      var href = $(e.target).attr('href').substring(1);
      $(e.target).attr('tabindex', 0)
      $('#' + href).focus();
      $(e.target).attr('tabindex', 1)
    }

  }, {
    template: 'bypassBlock'
  });

  return BypassBlockView;
});
