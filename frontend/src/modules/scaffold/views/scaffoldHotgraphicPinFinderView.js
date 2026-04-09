define(['core/origin', 'backbone-forms'], function (Origin, BackboneForms) {
  var ScaffoldHotgraphicPinFinderView = Backbone.Form.editors.Base.extend({

    className: 'scaffold-hotgraphic-pinfinder-editor',

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
      var mainHotgraphicImg = $('.component-edit-inner').find("[data-key='properties']").find("img.scaffold-asset-preview");
      if (mainHotgraphicImg.length > 0) {
        this.enablePinEditor();
      }
      else {
        this.disablePinEditor();
      }
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
        Origin.trigger('hotgraphicpinfinder:open', this);
      } else {
        var errorMsg = Origin.l10n.t('app.hotgraphicpinfinder.error') || 'You must select an image as main hotgraphic src to use the pin editor.';
        this.$el.find('.field-error').text(errorMsg);
      }
    },

    remove: function () {
      Backbone.View.prototype.remove.apply(this, arguments);
    }

  }, { template: 'scaffoldHotgraphicPinFinder' });

  Origin.on('origin:dataReady', function () {
    Origin.scaffold.addCustomField('HotgraphicPinFinder', ScaffoldHotgraphicPinFinderView);
  });

  return ScaffoldHotgraphicPinFinderView;

});
