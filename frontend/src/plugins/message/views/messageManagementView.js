// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Backbone = require('backbone');
  var Handlebars = require('handlebars');
  var OriginView = require('core/views/originView');
  var Origin = require('core/origin');
  const character_limit = 260;

  var MessageManagementView = OriginView.extend({
    tagName: 'div',
    className: 'message-management',

    preRender: function () {
      this.listenTo(Origin, 'messageManagementSidebar:views:save', this.saveMessage);
      this.listenTo(this.model, 'invalid', this.handleValidationError);
    },

    postRender: function () {
      this.initCKEditor('#generalRibbonEN');
      this.initCKEditor('#generalRibbonFR');
      var options = {
        showInput: true,
        preferredFormat: "hex",
        showPalette: true,
        palette: [
          ['#26374A', '#1C578A', '#1C578A'],
          ['#CD1C6A', '#69459C'],
          ['#E6E6E6', '#FFFFFF', '#000000'],
          ['#56cdb0', '#ecd000'],
        ]
      }
      $("#generalRibbonBgColor").spectrum(options);
      $("#generalRibbonTextColor").spectrum(options);
      $("#generalRibbonBgColor").spectrum("set", this.model.get('generalRibbonBgColor'));
      $("#generalRibbonTextColor").spectrum("set", this.model.get('generalRibbonTextColor'));
      this.setViewToReady();
    },

    initCKEditor: function (target) {
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
        .create($(target)[0], {
          language: {
            ui: language,
            textPartLanguage: [
              { title: 'English', languageCode: 'en' },
              { title: 'Français', languageCode: 'fr' }
            ]
          },
          htmlSupport: {
            allow: [
              {
                name: 'abbr',
                attributes: {
                  title: true
                }
              }
            ],
            disallow: [ /* HTML features to disallow. */]
          },
          additionalLanguages: ['en', 'fr'],
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
          toolbar: {
            items: [
              'sourceEditing', 'showBlocks', '|',
              'undo', 'redo', '|',
              'findAndReplace', 'selectAll', '|',
              'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'removeFormat', '|',
              'numberedList', 'bulletedList', 'alignment', 'indent', 'outdent', '|',
              'blockQuote', '|',
              'link', '|',
              'fontColor', 'fontBackgroundColor', '|',
              'specialCharacters', '|', 'abbreviation', 'textPartLanguage'
            ],
            shouldNotGroupWhenFull: true
          }
        })
        .catch((error) => { });
      this.editor = watchdog;
    },

    handleValidationError: function (model, error) {
      Origin.trigger('sidebar:resetButtons');
      if (error && _.keys(error).length !== 0) {
        _.each(error, function (value, key) {
          this.$('#' + key + 'Error').text(value);
        }, this);
        this.$('.error-text').removeClass('display-none');
      }
    },

    saveMessage: function () {
      var self = this;

      this.$('.error-text').addClass('display-none');
      this.$('.error').text('');

      var toChange = {
        generalRibbonEnabled: self.$('#generalRibbonEnable')[0].checked,
        generalRibbonEN: $('.ck-editor__editable_inline')[0].ckeditorInstance.getData(),
        generalRibbonFR: $('.ck-editor__editable_inline')[1].ckeditorInstance.getData(),
        generalRibbonBgColor: $("#generalRibbonBgColor").spectrum('get').toHexString(),
        generalRibbonTextColor: $("#generalRibbonTextColor").spectrum('get').toHexString(),
      };

      _.extend(toChange, {
        _id: self.model.get('_id')
      });

      self.model.save(toChange, {
        wait: true,
        patch: true,
        error: function (data, error) {
          Origin.trigger('sidebar:resetButtons');
          Origin.Notify.alert({
            type: 'error',
            text: error.responseText || Origin.l10n.t('app.errorgeneric')
          });
        },
        success: function (model) {
          Backbone.history.history.back();
          Origin.trigger('messageManagementSidebar:views:saved');
        }
      });
    },
  }, {
    template: 'messageManagement'
  });

  return MessageManagementView;
});
