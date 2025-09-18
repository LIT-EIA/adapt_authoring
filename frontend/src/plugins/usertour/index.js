// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Origin = require('core/origin');
  Origin.on('origin:dataReady login:changed', function () {
    if (Origin.constants['useUsertour']) {
      window.USERTOURJS_ENV_VARS = {
        WS_URI: Origin.constants['usertourWS'],
        ASSETS_URI: Origin.constants['usertourWS'] + "/sdk/",
        USERTOURJS_ES2020_URL: Origin.constants['usertourWS'] + '/sdk/es2020/usertour.js',
        USERTOURJS_LEGACY_URL: Origin.constants['usertourWS'] + "/sdk/legacy/usertour.iife.js"
      };
      usertour.init(Origin.constants['usertourToken']);
      usertour.identifyAnonymous();
    }
  });
})
