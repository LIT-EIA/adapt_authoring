// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Backbone = require('backbone');
  var Helpers = require('core/helpers');
  var Origin = require('core/origin');
  var _ = require('underscore');

  var HelpDialogManagementModel = Backbone.Model.extend({

    idAttribute: '_id',
    url: 'api/helpdialogs',

    schema: {
      helpDialogEnabled: {
        type: "Checkbox",
        inputType: "Checkbox",
        title: `${Origin.l10n.t('app.enabled')}`,
        titleLabel: `${Origin.l10n.t('app.enabled')}`
      },
      helpDialogTitleEN: {
        type: "Text",
        inputType: "Text",
        title: `${Origin.l10n.t('app.title')} EN`,
        titleLabel: `${Origin.l10n.t('app.title')} EN`
      },
      helpDialogTitleFR: {
        type: "Text",
        inputType: "Text",
        title: `${Origin.l10n.t('app.title')} FR`,
        titleLabel: `${Origin.l10n.t('app.title')} FR`
      },
      helpDialogEN: {
        type: "TextArea",
        inputType: "TextArea",
        title: `${Origin.l10n.t('app.bodytext')} EN`,
        titleLabel: `${Origin.l10n.t('app.bodytext')} EN`
      },
      helpDialogFR: {
        type: "TextArea",
        inputType: "TextArea",
        title: `${Origin.l10n.t('app.bodytext')} FR`,
        titleLabel: `${Origin.l10n.t('app.bodytext')} FR`
      },
      properties: {
        type: "Object",
        subSchema: {
          _businessLines: {
            title: `${Origin.l10n.t('app.businesslines')}`,
            titleLabel: `${Origin.l10n.t('app.businesslines')}`,
            itemType: "Object",
            type: "List",
            subSchema: {
              titleEN: {
                type: "Text",
                inputType: "Text",
                title: `${Origin.l10n.t('app.title')} EN`,
                titleLabel: `${Origin.l10n.t('app.title')} EN`
              },
              titleFR: {
                type: "Text",
                inputType: "Text",
                title: `${Origin.l10n.t('app.title')} FR`,
                titleLabel: `${Origin.l10n.t('app.title')} FR`
              },
              atptRepresentative: {
                type: "UsersWithEmail",
                inputType: "UsersWithEmail",
                items: {
                  type: "objectid",
                  inputType: "Text",
                  required: false,
                  editorOnly: true,
                  ref: "user"
                },
                title: `${Origin.l10n.t('app.representative.atpt')}`,
                titleLabel: `${Origin.l10n.t('app.representative.atpt')}`
              },
              a11yTeamRepresentative: {
                type: "UsersWithEmail",
                inputType: "UsersWithEmail",
                items: {
                  type: "objectid",
                  inputType: "Text",
                  required: false,
                  editorOnly: true,
                  ref: "user"
                },
                title: `${Origin.l10n.t('app.representative.alliesnetwork')}`,
                titleLabel: `${Origin.l10n.t('app.representative.alliesnetwork')}`
              }
            }
          }
        }
      }
    },

    validate: function (attributes, options) {
      var validationErrors = {};
      if (!attributes.helpDialogEN) {
        validationErrors.helpDialogEN = Origin.l10n.t('app.validationrequired');
      }
      if (!attributes.helpDialogFR) {
        validationErrors.helpDialogFR = Origin.l10n.t('app.validationrequired');
      }

      return _.isEmpty(validationErrors) 
      ? null
      : validationErrors;
    }

  });

  return HelpDialogManagementModel;

});