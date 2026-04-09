define(['core/origin', 'backbone-forms'], function (Origin, BackboneForms) {
  var ScaffoldGuidedTourPinFinderView = Backbone.Form.editors.Base.extend({

    className: 'scaffold-guided-tour-pinfinder-editor',

    events: {
      "click .edit-pin-position": "editPinPosition"
    },

    initialize: function (options) {
      Backbone.Form.editors.Base.prototype.initialize.call(this, options);
      this.template = options.template || this.constructor.template;
    },

    preRender: function () {
      this.imageReady = this.form && this.form.data && this.form.data._graphic && this.form.data._graphic.src;
    },

    render: function () {
      this.preRender();
      this.$el.append(Handlebars.templates[this.constructor.template](this));
      this.postRender();
      return this;
    },

    postRender: function () {
      if(this.form && this.form.fields && this.form.fields._graphic && this.form.fields._graphic.$el){
        var _graphic_src = this.form.fields._graphic.$el.find('#_graphic_src')[0];
        this.startObserver(_graphic_src);
      }
    },

    startObserver: function (targetNode) {
      var self = this;
      this.observer = new MutationObserver(function (mutationsList) {
        for (var mutation of mutationsList) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(function (node) {
              if (node.nodeName.toLowerCase() === 'img') {
                self.enablePinEditor();
              }
            });
            mutation.removedNodes.forEach(function (node) {
              if (node.nodeName.toLowerCase() === 'img') {
                self.disablePinEditor();
              }
            });
          }
        }
      });
      this.observer.observe(targetNode, { childList: true, subtree: true });
    },

    enablePinEditor: function () {
      this.imageReady = true;
      this.$el.find('.edit-pin-position').removeClass('disabled');
      this.$el.find('.field-error').text('');
    },

    disablePinEditor: function () {
      this.imageReady = false;
      this.$el.find('.edit-pin-position').addClass('disabled');
    },

    editPinPosition: function (e) {
      e.preventDefault();
      if (this.imageReady) {
        Origin.trigger('guidedtourpinfinder:open', this);
      } else {
        var errorMsg = Origin.l10n.t('app.pinfinder.error') || 'You must select an image as graphic src to use the pin editor.';
        this.$el.find('.field-error').text(errorMsg);
      }
    },

    remove: function () {
      this.observer.disconnect();
      Backbone.View.prototype.remove.apply(this, arguments);
    }

  }, { template: 'scaffoldGuidedTourPinFinder' });

  Origin.on('origin:dataReady', function () {
    Origin.scaffold.addCustomField('GuidedTourPinFinder', ScaffoldGuidedTourPinFinderView);
  });

  return ScaffoldGuidedTourPinFinderView;

});
