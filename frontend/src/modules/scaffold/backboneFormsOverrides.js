define([
  'core/origin',
  'backbone-forms',
  'backbone-forms-lists',
  'core/helpers',
  './views/scaffoldSelectScreenView',
  './views/scaffoldSimulationZoneFinderView',
  './views/scaffoldAssetView'
], function (Origin, BackboneForms, BackboneFormsList, Helpers, ScaffoldSelectScreenView, ScaffoldSimulationZoneFinderView, ScaffoldAssetView) {

  var templates = Handlebars.templates;
  var fieldTemplate = templates.field;
  var templateData = Backbone.Form.Field.prototype.templateData;
  var initialize = Backbone.Form.editors.Base.prototype.initialize;
  var textInitialize = Backbone.Form.editors.Text.prototype.initialize;
  var textAreaRender = Backbone.Form.editors.TextArea.prototype.render;
  var textAreaSetValue = Backbone.Form.editors.TextArea.prototype.setValue;

  function applyFieldConditions(self) {

    let hasAndConditions = self.schema && self.schema.conditions && self.schema.conditions.and && self.schema.conditions.and.length > 0;
    let hasOrConditions = self.schema && self.schema.conditions && self.schema.conditions.or && self.schema.conditions.or.length > 0;

    if (!(hasAndConditions || hasOrConditions)) {
      return;
    }

    let andConditionResults = {};
    let orConditionResults = {};

    function toggleFieldVisibility() {
      let $el = self.form.$el.find(`[data-editor-id="${self.id}"]`);
      let passedAndConditions = hasAndConditions && !Object.values(andConditionResults).includes("failed");
      let failedAndConditions = hasAndConditions && Object.values(andConditionResults).includes("failed");
      let passedOrConditions = hasOrConditions && Object.values(orConditionResults).includes("passed");
      let failedOrConditions = hasOrConditions && !Object.values(orConditionResults).includes("passed");

      if ((hasAndConditions && Object.keys(andConditionResults).length < 1) ||
        (hasOrConditions && Object.keys(orConditionResults).length < 1) ||
        (hasAndConditions && failedAndConditions) ||
        (hasOrConditions && failedOrConditions)) {
          $el.hide();
      }
      else if (passedAndConditions || passedOrConditions) {
        $el.show();
      }
    }

    function getAndConditionResult(val, obj) {
      let passedValue = obj['value'] && (obj['value']).split(',').includes(val);
      let failedValue = obj['value'] && !(obj['value']).split(',').includes(val);
      let passedNotValue = obj['!value'] && !(obj['!value']).split(',').includes(val);
      let failedNotValue = obj['!value'] && (obj['!value']).split(',').includes(val);

      if (passedValue || passedNotValue) {
        andConditionResults[obj['name']] = 'passed';
      }
      else if (failedValue || failedNotValue) {
        andConditionResults[obj['name']] = 'failed';
      }
    }

    function getOrConditionResult(val, obj) {
      let passedValue = obj['value'] && (obj['value']).split(',').includes(val);
      let failedValue = obj['value'] && !(obj['value']).split(',').includes(val);
      let passedNotValue = obj['!value'] && !(obj['!value']).split(',').includes(val);
      let failedNotValue = obj['!value'] && (obj['!value']).split(',').includes(val);

      if (passedValue || passedNotValue) {
        orConditionResults[obj['name']] = 'passed';
      }
      else if (failedValue || failedNotValue) {
        orConditionResults[obj['name']] = 'failed';
      }
    }

    function getElement(obj) {
      let formField = self.form.fields[obj['name']];
      let $el = formField ? self.form.fields[obj['name']].editor.$el : null;
      let objNames = obj['name'].split('.');
      if (objNames.length > 1) {
        $el = self.form.fields[objNames[0]].editor.$el.find(`[data-editor-id="${objNames[0]}_${objNames[objNames.length - 1]}"]`);
        let editor = self.form.fields[objNames[0]].editor;
        for (let index = 1; index < objNames.length; index++) {
          let name = objNames[index];
          let nestedForm = editor.nestedForm;
          if (nestedForm) {
            editor = nestedForm.fields[name].editor;
          }
        }
        $el = editor.$el;
      }
      return $el;
    }

    function getEditorValue(element, obj) {
      if (!element) {
        return '';
      }
      let editorValue = element.val();

      if (element.prop('type') == 'checkbox') {
        editorValue = element.prop('checked');
      }

      if (obj['id']) {
        editorValue = element.find(`#${obj['id']}`).val();
      }
      // some editors (e.g. checkbox) return values (e.g. on, off) that don't match the type of the field (e.g. boolean - true/false)
      switch (editorValue) {
        case "on":
          editorValue = "true";
          break;
        case "off":
          editorValue = "false";
          break;
        default:
          break;
      }
      return String(editorValue);
    }

    if (hasAndConditions) {
      for (const obj of self.schema.conditions.and) {
        if (!obj || !obj['name'] || !(obj['value'] || obj['!value'])) {
          continue;
        }
        let element = getElement(obj);
        if (element) {
          element.on('change', function(e) {
            getAndConditionResult(getEditorValue(getElement(obj), obj), obj);
            toggleFieldVisibility();
          });
          getAndConditionResult(getEditorValue(getElement(obj), obj), obj);
          toggleFieldVisibility();
        }
      }
    }

    if (hasOrConditions) {
      for (const obj of self.schema.conditions.or) {
        if (!obj || !obj['name'] || !(obj['value'] || obj['!value'])) {
          continue;
        }
        let element = getElement(obj);
        if (element) {
          element.on('change', function (e) {
            getOrConditionResult(getEditorValue(getElement(obj), obj), obj);
            toggleFieldVisibility();
          });
          getOrConditionResult(getEditorValue(getElement(obj), obj), obj);
          toggleFieldVisibility();
        }
      }
    }
  }

  Backbone.Form.prototype.constructor.template = templates.form;

  var FieldsetBaseRender = Backbone.Form.Fieldset.prototype.render;
  Backbone.Form.Fieldset.prototype.render = function (options) {
    _.defer(_.bind(function () {
      if (this && this.fields) {
        Object.values(this.fields).forEach(function(field) {
          if (field && field.schema && field.schema.conditions && field.schema.fieldType === 'Object') {
            applyFieldConditions(field && field.editor ? field.editor : field);
          }
        })
      }
    }, this));
    return FieldsetBaseRender.call(this);
  }
  Backbone.Form.Fieldset.prototype.template = templates.fieldset;
  Backbone.Form.Field.prototype.template = fieldTemplate;
  Backbone.Form.NestedField.prototype.template = fieldTemplate;

  // add reset to default handler
  Backbone.Form.Field.prototype.events = {
    'click [data-action="default"]': function() {
      this.setValue(this.editor.defaultValue);
      this.editor.trigger('change', this);

      return false;
    }
  };

  // merge schema into data
  Backbone.Form.Field.prototype.templateData = function() {
    return _.extend(templateData.call(this), this.schema, {
      isDefaultValue: _.isEqual(this.editor.value, this.editor.defaultValue)
    });
  };

  // use default from schema and set up isDefaultValue toggler
  Backbone.Form.editors.Base.prototype.initialize = function(options) {
    var schemaDefault = options.schema.default;

    if (schemaDefault !== undefined && options.id) {
      this.defaultValue = schemaDefault;
    }

    this.listenTo(this, 'change', function() {
      if (this.hasNestedForm) return;

      var isDefaultValue = _.isEqual(this.getValue(), this.defaultValue);

      this.form.$('[data-editor-id="' + this.id + '"]')
        .toggleClass('is-default-value', isDefaultValue);
    });

    initialize.call(this, options);
  };

  // disable automatic completion on text fields if not specified
  Backbone.Form.editors.Text.prototype.initialize = function(options) {
    textInitialize.call(this, options);

    if (!this.$el.attr('autocomplete')) {
      this.$el.attr('autocomplete', 'off');
    }
  };

  var CheckboxBaseRender = Backbone.Form.editors.Checkbox.prototype.render;

  Backbone.Form.editors.Checkbox.prototype.render = function (options) {
    _.defer(_.bind(function () {
      applyFieldConditions(this)
    }, this));
    return CheckboxBaseRender.call(this);
  }

  var TextBaseRender = Backbone.Form.editors.Text.prototype.render;

  Backbone.Form.editors.Text.prototype.render = function (options) {
    _.defer(_.bind(function () {
      applyFieldConditions(this)
    }, this));
    if(this.schema.placeholder){
       this.$el.attr('placeholder', this.schema.placeholder);
    }
    return TextBaseRender.call(this);
  }

  Backbone.Form.editors.TextArea.prototype.className = "cke_replace";

  // render ckeditor in textarea
  Backbone.Form.editors.TextArea.prototype.render = function() {
    textAreaRender.call(this);
    let defaultLanguage;
    if (Origin.editor.data && Origin.editor.data.config && Origin.editor.data.config.get('_defaultLanguage')) {
      defaultLanguage = Origin.editor.data.config.get('_defaultLanguage');
    }

    let textLanguageParts = [
      defaultLanguage === 'en' ? { title: 'Français', languageCode: 'fr' } : { title: 'English', languageCode: 'en' }
    ];


    _.delay(function() {
      var language = document.documentElement.lang;
      var watchdog = new CKSource.EditorWatchdog();
      watchdog.setCreator((element, config) => {
        return CKSource.Editor
          .create(element, config)
          .then(editor => {
            return editor;
          });
      });

      watchdog
        .create(this.$el[0], {
          language: {
            ui: language,
            textPartLanguage: textLanguageParts
          },
          unsafeElements: false,
          htmlSupport: {
            allow: [
              {
                // name: /^(div|span|svg|abbr|path)$/,
                name: /.*/,
                attributes: true,
                classes: true,
                styles: true,
                content: true
              }
            ],
            disallow: [
              {
                name: /^(script|video|audio|img|var)$/
              }
            ]
          },
          additionalLanguages: ['en', 'fr'],
          fontSize: {
            options: [
              'default',
              'big',
              'huge'
            ]
          },
          link: {
            decorators: {
              openInNewTab: {
                mode: 'manual',
                label: 'Open in a new tab',
                attributes: {
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }
            }
          },
          table: {
            contentToolbar: [
              'toggleTableCaption',
              'tableColumn', 'tableRow', 'mergeTableCells',
              'tableCellProperties', 'tableProperties'
            ],
            tableProperties: {
              defaultProperties: {
                width: '100%'
              }
            }
          },
          toolbar: {
            items: [
              'sourceEditing', 'showBlocks', '|',
              'undo', 'redo', '|',
              'findAndReplace', 'selectAll', '|',
              'fontSize', '|',
              'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'removeFormat', '|',
              'numberedList', 'bulletedList', 'alignment', 'indent', 'outdent', '|',
              'blockQuote', '|',
              'link', '|',
              'fontColor', 'fontBackgroundColor', '|',
              'specialCharacters', 'insertTable', '|', 'abbreviation', 'textPartLanguage'
            ],
            shouldNotGroupWhenFull: true
          }
        })
        .then(() => {
          applyFieldConditions(this);
          this.postRender();
        })
        .catch((error) => {});
      this.editor = watchdog;
    }.bind(this), 50);
    return this;
  };

  // get data from ckeditor in textarea
  Backbone.Form.editors.TextArea.prototype.getValue = function() {
    return this.editor && this.editor.editor ? this.editor.editor.getData() : null;
  };

  // set value in ckeditor
  Backbone.Form.editors.TextArea.prototype.setValue = function(value) {
    textAreaSetValue.call(this, value);

    if (this.editor && this.editor.editor) {
      this.editor.editor.setData(value);
    }
  };

  // ckeditor removal
  Backbone.Form.editors.TextArea.prototype.remove = function() {
    if (this.editor) {
      this.editor.destroy()
        .then(() => {})
        .catch(error => {});
    }
  };

  var ScaffoldAssetViewBaseRender = ScaffoldAssetView.prototype.render;

  ScaffoldAssetView.prototype.render = function(){
    _.defer(_.bind(function () {
      applyFieldConditions(this)
    }, this));
    return ScaffoldAssetViewBaseRender.call(this);
  }

  var ScaffoldSimulationZoneFinderViewBaseRender = ScaffoldSimulationZoneFinderView.prototype.render;

  ScaffoldSimulationZoneFinderView.prototype.render = function(){
    _.defer(_.bind(function () {
      applyFieldConditions(this)
    }, this));
    return ScaffoldSimulationZoneFinderViewBaseRender.call(this);
  }

  var ScaffoldSelectScreenViewBaseRender = ScaffoldSelectScreenView.prototype.render;

  ScaffoldSelectScreenView.prototype.render = function(){
    _.defer(_.bind(function () {
      applyFieldConditions(this)
    }, this));
    return ScaffoldSelectScreenViewBaseRender.call(this);
  }

  var SelectBaseRender = Backbone.Form.editors.Select.prototype.render;
  Backbone.Form.editors.Select.prototype.render = function(options) {
    _.defer(_.bind(function () {
      applyFieldConditions(this)
    }, this));
    return SelectBaseRender.call(this);
  }


  // ESDC - added override on arrayToHtml for select tags so the option can be added as id and the value translated
  Backbone.Form.editors.Select.prototype._arrayToHtml = function(array) {
    var html = $();
    //Generate HTML
    _.each(array, function(option) {
      if (_.isObject(option)) {
        if (option.group) {
          var optgroup = $("<optgroup>")
            .attr("label",option.group)
            .html( this._getOptionsHtml(option.options) );
          html = html.add(optgroup);
        } else {
          var val = (option.val || option.val === 0) ? option.val : '';
          html = html.add( $('<option>').val(val).text(option.label) );
        }
      }
      else {
        var keyOptions = { parent: this.key, key: option, type: 'variable' };
        var optionString = Helpers.keyToTranslatedString(keyOptions) || option;
        html = html.add($(`<option id=${option} value="${option}">`).text(optionString));
      }
    }, this);

    return html;
  }

  // add override to allow prevention of validation
  Backbone.Form.prototype.validate = function(options) {
    var self = this,
        fields = this.fields,
        model = this.model,
        errors = {};

    options = options || {};

    //Collect errors from schema validation
    // passing in validate: false will stop validation of the backbone forms validators
    if (!options.skipModelValidate) {
      _.each(fields, function(field) {
        var error = field.validate();

        if (!error) return;

        var title = field.schema.title;

        if (title) {
            error.title = title;
        }

        errors[field.key] = error;
      });
    }

    //Get errors from default Backbone model validator
    if (!options.skipModelValidate && model && model.validate) {
      var modelErrors = model.validate(this.getValue());

      if (modelErrors) {
        var isDictionary = _.isObject(modelErrors) && !_.isArray(modelErrors);

        //If errors are not in object form then just store on the error object
        if (!isDictionary) {
          errors._others = errors._others || [];
          errors._others.push(modelErrors);
        }

        //Merge programmatic errors (requires model.validate() to return an object e.g. { fieldKey: 'error' })
        if (isDictionary) {
          _.each(modelErrors, function(val, key) {
            //Set error on field if there isn't one already
            if (fields[key] && !errors[key]) {
              fields[key].setError(val);
              errors[key] = val;
            }

            else {
              //Otherwise add to '_others' key
              errors._others = errors._others || [];
              var tmpErr = {};
              tmpErr[key] = val;
              errors._others.push(tmpErr);
            }
          });
        }
      }
    }

    return _.isEmpty(errors) ? null : errors;
  };

  // allow hyphen to be typed in number fields
  Backbone.Form.editors.Number.prototype.onKeyPress = function(event) {
    var self = this,
      delayedDetermineChange = function() {
        setTimeout(function() {
        self.determineChange();
      }, 0);
    };

    //Allow backspace
    if (event.charCode === 0) {
      delayedDetermineChange();
      return;
    }

    //Get the whole new value so that we can prevent things like double decimals points etc.
    var newVal = this.$el.val()
    if( event.charCode != undefined ) {
      newVal = newVal + String.fromCharCode(event.charCode);
    }

    var numeric = /^-?[0-9]*\.?[0-9]*?$/.test(newVal);

    if (numeric) {
      delayedDetermineChange();
    }
    else {
      event.preventDefault();
    }
  };

  var ListBaseRender = Backbone.Form.editors.List.prototype.render;
  Backbone.Form.editors.List.prototype.render = function (options) {
    _.defer(_.bind(function() {
      applyFieldConditions(this)
    }, this));
    return ListBaseRender.call(this);
  }

  Backbone.Form.editors.List.prototype.validate = function(){
    var listValidatorMessage;
    //Collect errors
    var errors = _.map(this.items, function(item) {
      var validated = item.validate();
      // show listValidator messages in priority
      if(validated && validated.type === 'ListValidator'){
        listValidatorMessage = validated.message;
      }
      return validated;
    });

    //Check if any item has errors
    var hasErrors = _.compact(errors).length ? true : false;
    if (!hasErrors) return null;

    //If so create a shared error
    var fieldError = {
      type: 'list',
      message: listValidatorMessage ? listValidatorMessage : 'Some of the items in the list failed validation',
      errors: errors
    };

    return fieldError;
  }

  Backbone.Form.validators = (function() {

    var translateValidator = function(key){
      var translatedKey = Origin.l10n.t(key);
      if (Origin.constants.translating) {
        return translatedKey !== key ? translatedKey : key;
      } else {
        return translatedKey !== key ? translatedKey : undefined;
      }
    }

    var validators = {};

    //need to use translation here
    validators.errMessages = {
      required: translateValidator('app.forms.validators.required') || 'Required',
      regexp: translateValidator('app.forms.validators.invalid') || 'Invalid',
      number: translateValidator('app.forms.validators.number') || 'Must be a number',
      range: _.template((translateValidator('app.forms.validators.range') || 'Must be a number between <%= min %> and <%= max %>'), null, Backbone.Form.templateSettings),
      email: translateValidator('app.forms.validators.email') || 'Invalid email address',
      url: translateValidator('app.forms.validators.url') || 'Invalid URL',
      urlSaba: translateValidator('app.forms.validators.urlSaba') || 'URL must be a Saba Profile',
      match: _.template((translateValidator('app.forms.validators.match') || 'Must match field "<%= field %>"'), null, Backbone.Form.templateSettings),
      minimumItems2: translateValidator('app.forms.validators.minimumItems2') || 'You need at least two items'
    };

    validators.required = function(options) {
      options = _.extend({
        type: 'required',
        message: this.errMessages.required
      }, options);

      return function required(value) {
        options.value = value;

        var err = {
          type: options.type,
          message: _.isFunction(options.message) ? options.message(options) : options.message
        };

        if (value === null || value === undefined || value === false || value === '' || $.trim(value) === '' ) return err;
      };
    };

    validators.regexp = function(options) {
      if (!options.regexp) throw new Error('Missing required "regexp" option for "regexp" validator');

      options = _.extend({
        type: 'regexp',
        match: true,
        message: this.errMessages.regexp
      }, options);

      return function regexp(value) {
        options.value = value;

        var err = {
          type: options.type,
          message: _.isFunction(options.message) ? options.message(options) : options.message
        };

        //Don't check empty values (add a 'required' validator for this)
        if (value === null || value === undefined || value === '') return;

        //Create RegExp from string if it's valid
        if ('string' === typeof options.regexp) options.regexp = new RegExp(options.regexp, options.flags);

        if ((options.match) ? !options.regexp.test(value) : options.regexp.test(value)) return err;
      };
    };

    validators.number = function(options) {
      options = _.extend({
        type: 'number',
        message: this.errMessages.number,
        regexp: /^[-+]?([0-9]*.[0-9]+|[0-9]+)$/
      }, options);

      return validators.regexp(options);
    };

    validators.range = function(options) {
      options = _.extend({
        type: 'range',
        message: this.errMessages.range,
        numberMessage: this.errMessages.number,
        min: 0,
        max: 100
      }, options);

      return function range(value) {
        options.value = value;
        var err = {
          type: options.type,
          message: _.isFunction(options.message) ? options.message(options) : options.message
        };

        //Don't check empty values (add a 'required' validator for this)
        if (value === null || value === undefined || value === '') return;

        // check value is a number
        var numberCheck = validators.number({message: options.numberMessage})(value);
        if (numberCheck) return numberCheck;

        // check value is in range
        var number = parseFloat(options.value);
        if (number < options.min || number > options.max) return err;
      }
    }

    validators.email = function(options) {
      options = _.extend({
        type: 'email',
        message: this.errMessages.email,
        regexp: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i
      }, options);

      return validators.regexp(options);
    };

    validators.url = function(options) {
      options = _.extend({
        type: 'url',
        message: this.errMessages.url,
        regexp: /^((http|https):\/\/)?(([A-Z0-9][A-Z0-9_\-]*)(\.[A-Z0-9][A-Z0-9_\-]*)+)(:(\d+))?\/?/i
      }, options);

      return validators.regexp(options);
    };

    validators.urlSaba = function(options) {
      options = _.extend({
        type: 'urlSaba',
        message: this.errMessages.urlSaba,
        regexp: /^https:\/\/esdc\.sabacloud\.com\/.*$/g
      }, options);

      return validators.regexp(options);
    };

    validators.match = function(options) {
      if (!options.field) throw new Error('Missing required "field" options for "match" validator');

      options = _.extend({
        type: 'match',
        message: this.errMessages.match
      }, options);

      return function match(value, attrs) {
        options.value = value;

        var err = {
          type: options.type,
          message: _.isFunction(options.message) ? options.message(options) : options.message
        };

        //Don't check empty values (add a 'required' validator for this)
        if (value === null || value === undefined || value === '') return;

        if (value !== attrs[options.field]) return err;
      };
    };

    validators.minimumItems2 = function(options){

      options = _.extend({
        type: 'ListValidator',
        message: this.errMessages.minimumItems2
      }, options);

      return function minimumItems2(value, attrs) {
        return (attrs._items && attrs._items.length >= 2) ? undefined : {
            type: options.type,
            message: _.isFunction(options.message) ? options.message(options) : options.message
          }
      };
    }

    return validators;

  })();

});
