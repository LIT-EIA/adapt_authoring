define(function (require) {
  var Origin = require('core/origin');
  var Helpers = require('core/helpers');
  Origin.on('origin:initialize location:change', function (e) {
    $(document).ready(function () {
      if (!Origin.users && Helpers.isClosedRoute()) {
        $.ajax({
          url: 'api/user',
          method: 'GET',
          async: false,
          success: function (result) {
            Origin.users = result;
          }
        });
      }
    });
  });

})
