define(['core/origin', 'backbone-forms'], function (Origin, BackboneForms) {
  var ScaffoldUniqueFieldView = Backbone.Form.editors.Base.extend({

    className: 'scaffold-unique-field-editor',

    events: {

    },

    initialize: function (options) {
      Backbone.Form.editors.Base.prototype.initialize.call(this, options);
      this.template = options.template || this.constructor.template;
    },

    generateUniqueID: function () {
      const uuid = crypto.randomUUID(); // Generate UUID
      const randomNumbers = Math.floor(1000 + Math.random() * 9000); // Generate 4 random digits (1000-9999)
      return `${uuid}-${randomNumbers}`;
    },

    preRender: function () {
      if (this.form.data && this.form.data.duplicated) {
        var duplicated = true;
        this.form.data.duplicated = false;
      }

      var duplicated = duplicated || false;

      this.uniqueID = this.value && !duplicated ? this.value : this.generateUniqueID();
    },

    render: function () {
      this.preRender();
      this.$el.append(Handlebars.templates[this.constructor.template](this));
      this.postRender();
      return this;
    },

    postRender: function () {

    },

    getValue: function () {
      var val = this.$el.find('input').val();
      return val;
    },

    remove: function () {
      Backbone.View.prototype.remove.apply(this, arguments);
    }

  }, { template: 'scaffoldUniqueField' });

  Origin.on('origin:dataReady', function () {
    Origin.scaffold.addCustomField('UniqueID', ScaffoldUniqueFieldView);
  });

  return ScaffoldUniqueFieldView;

});
