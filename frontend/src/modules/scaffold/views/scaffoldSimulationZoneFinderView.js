define(['core/origin', 'backbone-forms'], function (Origin, BackboneForms) {
  var ScaffoldSimulationZoneFinderView = Backbone.Form.editors.Base.extend({

    className: 'scaffold-simulation-zonefinder-editor',

    events: {
      "click .edit-zone": "editZone"
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
      var simulationScreenImg = $('.scaffold-items-modal-sidebar #_graphic_src img.scaffold-asset-preview');
      if (simulationScreenImg.length > 0) {
        this.enablePinEditor();
      }
      else {
        this.disablePinEditor();
      }
    },

    enablePinEditor: function () {
      this.imageReady = true;
      this.$el.find('.edit-zone').removeClass('disabled');
      this.$el.find('.field-error').text('');
    },

    disablePinEditor: function () {
      this.imageReady = false;
      this.$el.find('.edit-zone').addClass('disabled');
    },

    editZone: function (e) {
      e.preventDefault();
      if (this.imageReady) {
        Origin.trigger('simulationzonefinder:open', this);
      } else {
        var errorMsg = Origin.l10n.t('app.simulationzonefinder.error') || 'You must select an image as main screen src to use the zone editor.';
        this.$el.find('.field-error').text(errorMsg);
      }
    },

    remove: function () {
      Backbone.View.prototype.remove.apply(this, arguments);
    }

  }, { template: 'scaffoldSimulationZoneFinder' });

  Origin.on('origin:dataReady', function () {
    Origin.scaffold.addCustomField('SimulationZoneFinder', ScaffoldSimulationZoneFinderView);
  });

  return ScaffoldSimulationZoneFinderView;

});
