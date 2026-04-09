define(['core/origin', 'backbone-forms'], function (Origin, BackboneForms) {
  var ScaffoldReadableIDView = Backbone.Form.editors.Base.extend({

    className: 'scaffold-readable-id-editor',

    events: {
      "input #_readableID": "handleInputChange"
    },

    initialize: function (options) {
      Backbone.Form.editors.Base.prototype.initialize.call(this, options);
      this.template = options.template || this.constructor.template;
    },

    preRender: function () {
      var title = this.value;
      this.readableID = this.stringToCamelCase(title);
    },

    render: function () {
      this.preRender();
      this.readableIDLabel = Handlebars.templates['scaffoldReadableIDLabel'](this);
      this.$el.append(Handlebars.templates[this.constructor.template](this));
      this.setValue(this.value);
      return this;
    },

    handleInputChange: function(e){
      var value = $(e.target).val();
      this.readableID = this.stringToCamelCase(value);
      this.$el.find('.readable-id-label').html(Handlebars.templates['scaffoldReadableIDLabel'](this));
    },

    setValue: function (value) {
      this.$el.find('#_readableID').val(value);
    },

    getValue: function () {
      var val = this.$el.find('#_readableID').val();
      return val;
    },

    remove: function () {
      Backbone.View.prototype.remove.apply(this, arguments);
    },

    stringToCamelCase: function (str) {
      return str
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .map(function (word, index) {
          return index === 0
            ? word.toLowerCase()
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join('');
    }

  }, { template: 'scaffoldReadableID' });

  Origin.on('origin:dataReady', function () {
    Origin.scaffold.addCustomField('ReadableID', ScaffoldReadableIDView);
  });

  return ScaffoldReadableIDView;

});
