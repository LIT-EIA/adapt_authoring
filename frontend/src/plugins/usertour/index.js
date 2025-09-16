// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Origin = require('core/origin');
  Origin.on('origin:dataReady login:changed', function () {
    if (Origin.constants['useUsertour']) {
      window.USERTOURJS_ENV_VARS = {
        WS_URI: Origin.constants['usertourWS']
      };
      usertour.init(Origin.constants['usertourToken']);
      const user = Origin.sessionModel.get('firstName');
      const email = `${user.toLowerCase()}@example.com`;
      usertour.identify(email, {
        name: user,
        email: email
      });
    }
  });
})
