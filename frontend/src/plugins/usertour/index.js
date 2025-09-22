// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Origin = require('core/origin');
  Origin.on('location:change', function (event) {
    if (event && event.module && event.module !== 'user' && Origin.constants['useUsertour']) {
      if (usertour && !usertour.isIdentified()) {
        window.USERTOURJS_ENV_VARS = {
          WS_URI: Origin.constants['usertourWS'],
          ASSETS_URI: Origin.constants['usertourWS'] + "/sdk/",
          USERTOURJS_ES2020_URL: Origin.constants['usertourWS'] + '/sdk/es2020/usertour.js',
          USERTOURJS_LEGACY_URL: Origin.constants['usertourWS'] + "/sdk/legacy/usertour.iife.js"
        };
        if (Origin.sessionModel && Origin.sessionModel.get('isAuthenticated')) {
          $.ajax({
            url: 'api/user/me',
            method: 'GET',
            async: false,
            error: function (error) {
              console.log('error user me:', error);
            },
            success: function (result) {
              var role = result.rolesAsName[0];
              usertour.init(Origin.constants['usertourToken']);
              usertour.identifyAnonymous({
                role: role,
              });
            }
          });
        }
      }
    }
  });
})
