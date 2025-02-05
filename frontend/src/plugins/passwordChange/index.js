define(function (require) {
    var Origin = require('core/origin');
    var Helpers = require('core/helpers');
    var UserInfoModel = require('./models/userInfoModel');
    var PasswordFieldsView = require('./views/passwordFieldsView');
    var PasswordHelpers = require('plugins/passwordChange/passwordHelpers');

    Origin.once('dashboard:loaded', function (e) {
        var user = new UserInfoModel();
        user.fetch({
            success: function (model) {
                var genericId = 'ResetModal';
                var passwordToSave = '';
                var confirmPasswordToSave = '';
                model.set('fieldId', 'password')
                var passwordFieldsView = PasswordFieldsView({ model: model, genericId: genericId });
                function openPopup(){
                    var message = document.createElement("p");
                    message.classList.add("password-force-message");
                    message.innerHTML = Origin.l10n.t('app.passwordForceMessage');
                    passwordFieldsView.el.prepend(message);
                    Origin.Notify.alert({
                        type: 'warning',
                        html: passwordFieldsView.el,
                        showConfirmButton: true,
                        allowOutsideClick: false,
                        confirmButtonText: Origin.l10n.t('app.save'),
                        showCancelButton: false,
                        preConfirm: function (e) {
                            var passwordVal = passwordFieldsView.$el.find(`#password${genericId}`)[0].value;
                            var confirmPasswordVal = passwordFieldsView.$el.find(`#confirmPassword${genericId}`)[0].value;

                            var passwordErrors = PasswordHelpers.validatePassword(passwordVal);
                            var isConfirmPasswordValid = PasswordHelpers.validateConfirmationPassword(passwordVal, confirmPasswordVal);

                            passwordToSave = passwordVal;
                            confirmPasswordToSave = confirmPasswordVal;

                            var shouldConfirm = (passwordErrors.length == 0 && isConfirmPasswordValid);

                            var errorHash = {};

                            errorHash['password'] = passwordErrors.length > 0 ? `${Origin.l10n.t('app.passwordindicatormedium')}` : '';

                            errorHash['confirmPassword'] = !isConfirmPasswordValid ? `${Origin.l10n.t('app.confirmpasswordnotmatch')}` : '';

                            model.trigger('invalid', model, errorHash);

                            if (!shouldConfirm) return false;

                            var toChange = {
                                _id: model.get('_id'),
                                _isNewPassword: true,
                                email: model.get('email'),
                                email_prev: model.get('email'),
                                password: passwordVal,
                                lastPasswordChange: new Date().toISOString()
                            };

                            $.ajax({
                                url: 'api/user/me',
                                method: 'PUT',
                                data: toChange,
                                async: false,
                                success: function() {
                                    shouldConfirm = true;
                                },
                                error: function(error) {
                                    // for server error messages - will remove in future
                                    var errMsg = Helpers.translateData(error);
                                    passwordFieldsView.$el.find(`#passwordError${genericId}`).html(errMsg);
                                    passwordFieldsView.$el.find(`#confirmPasswordError${genericId}`).html('');
                                    shouldConfirm = false;
                                }
                            });
                            return shouldConfirm;
                        }
                    });
                }
                if (user.attributes.lastPasswordChange) {
                    var policyChange = new Date('2025-02-10T19:25:46.936Z');
                    var changeDate = new Date(user.attributes.lastPasswordChange);
                    if ((changeDate < policyChange)) {
                       openPopup();
                    }
                } else {
                    openPopup();
                }
            }
        })
    })
})
