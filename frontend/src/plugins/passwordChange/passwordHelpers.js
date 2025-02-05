define(function (require) {
  var passwordHelpers = {
    validatePassword: function(value) {
      var errors = []

      if (!value || value.length < 12) errors = ['tooshort', ...errors];

      return errors;
    },
    validateConfirmationPassword: function(password, confirmationPassword) {
      return confirmationPassword === password
    }
  }
  return passwordHelpers;
});
