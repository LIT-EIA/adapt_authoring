// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require){
  var OriginView = require('core/views/originView');
  var Origin = require('core/origin');
  var CHelpers = require('core/helpers');
  var Helpers = require('../helpers');
  var PasswordFieldsView = require('plugins/passwordChange/views/passwordFieldsView');
  var PasswordHelpers = require('plugins/passwordChange/passwordHelpers');
  var CourseTransferFieldsView = require('plugins/courseTransfer/views/courseTransferFieldsView');

  var UserView = OriginView.extend({
    tagName: 'div',
    className: function() {
      var className = 'user-item tb-row' + ' ' + this.model.get('_id');
      // 'current user styling
      if (this.model.get('_id') === Origin.sessionModel.get('id')) className += ' me';
      if (this.model.get('_isHidden')) className += ' display-none';
      return className;
    },
    isSelected: false,

    events: {
      'click': 'onClicked',

      'click a.edit': 'onEditClicked',
      'click a.save': 'onSaveClicked',
      'click a.cancel': 'onCancelClicked',

      'click a.saveRoles': 'onSaveRoleClicked',

      'click button.invite': 'onInviteClicked',
      'click button.resetPassword': 'onResetPasswordClicked',
      'click button.changePassword': 'onChangePasswordClicked',

      'click button.unlock': 'onResetLoginsClicked',

      'click button.disable': 'onDisableClicked',
      'click button.delete': 'onDeleteClicked',
      'click button.transfer': 'onTransferClicked',
      'click button.restore': 'onRestoreClicked'
    },

    preRender: function() {
      this.listenTo(Origin, 'userManagement:user:reset', this.resetView);
      this.listenTo(this.model, 'destroy', this.remove);
      this.listenTo(this.model, 'change:_isHidden', function(model, _isHidden) {
        this.$el.toggleClass('display-none', _isHidden);
      });
      this.listenTo(this, 'remove', this.remove);
    },

    render: function() {
      OriginView.prototype.render.apply(this, arguments);
      this.applyStyles();
    },

    applyStyles: function() {
      // disabled user styling
      if(this.model.get('_isDeleted') === true) {
        this.$el.addClass('inactive');
      } else {
        this.$el.removeClass('inactive');
      }
      // locked user styling
      if(this.model.get('_isLocked') === true) {
        this.$el.addClass('locked');
      } else {
        this.$el.removeClass('locked');
      }
      // selected user styling
      if(this.isSelected) {
        this.$el.addClass('selected');
        this.$('.edit-mode').removeClass('display-none');
        this.$('.write').addClass('display-none');
      } else {
        this.$el.removeClass('selected');
        this.$('.edit-mode').addClass('display-none');
        this.$('.write').addClass('display-none');
      }
    },

    resetView: function() {
      if(this.isSelected) {
        this.isSelected = false;
        this.applyStyles();
      }
    },

    setEditMode: function() {
      this.editMode = true;
      this.applyStyles();
    },

    setViewMode: function() {
      this.editMode = false;
      this.applyStyles();
    },

    // utilities in case the classes change
    getColumnFromDiv: function(div) { return $(div).closest('.tb-col-inner'); },
    getInputFromDiv: function(div) { return $('.input', this.getColumnFromDiv(div)); },

    disableFieldEdit: function(div) {
      $('.read', div).removeClass('display-none');
      $('.write', div).addClass('display-none');
    },

    enableFieldEdit: function(div) {
      $('.read', div).addClass('display-none');
      $('.write', div).removeClass('display-none').children('input').focus();
    },

    onEditClicked: function(event) {
      event && event.preventDefault();

      var $column = this.getColumnFromDiv(event.currentTarget);

      // disable any existing inputs first
      this.disableFieldEdit(this.$el);
      this.enableFieldEdit($column);
      var $input = this.getInputFromDiv($column);
      var inputType = $input.attr('type');
      if(inputType === "text" || inputType === "email") {
        $input.val(this.model.get($input.attr('data-modelKey')));
      }
    },

    onClicked: function(event) {
      if(!this.isSelected) {
        Origin.trigger('userManagement:user:reset');
        this.isSelected = true;
        this.applyStyles();
      }
    },

    onSaveClicked: function(event) {
      event && event.preventDefault();

      var $column = this.getColumnFromDiv(event.currentTarget);
      this.disableFieldEdit($column);

      // save if not the same as old value
      var $input = this.getInputFromDiv($column);
      if($input.val() && this.model.get($input.attr('data-modelKey')) !== $input.val()) {
        var inputObject = {};
        inputObject[$input.attr('data-modelKey')] = $input.val();
        this.updateModel(inputObject);
      }
    },

    onCancelClicked: function(event) {
      event && event.preventDefault();
      this.disableFieldEdit(this.getColumnFromDiv(event.currentTarget));
    },

    onSaveRoleClicked: function(event) {
      event && event.preventDefault();

      var $column = this.getColumnFromDiv(event.currentTarget);
      var $input = this.getInputFromDiv($column);
      var oldRole = this.model.get('roles')[0];
      var newRole = $input.val();

      this.disableFieldEdit($column);

      var self = this;
      if(newRole && this.model.get($input.attr('data-modelKey')) !== newRole) {
        Helpers.ajax('api/role/' + oldRole + '/unassign/' + this.model.get('_id'), null, 'POST', function() {
          Helpers.ajax('api/role/' + newRole + '/assign/' + self.model.get('_id'), null, 'POST', function() {
            self.model.fetch();
          });
        });
      }
    },

    onResetLoginsClicked: function() {
      var self = this;
      Origin.Notify.confirm({
        text: Origin.l10n.t('app.confirmresetlogins', { email: this.model.get('email') }),
        callback: function(confirmed) {
          if(confirmed) self.updateModel({ 
            failedLoginCount: 0,
            failedMfaCount: 0,
            mfaResetCount: 0,
            passwordResetCount: 0
          });
        }
      });
    },

    onInviteClicked: function(e) {
      Origin.Notify.confirm({
        text: Origin.l10n.t('app.confirmsendinvite', { email: this.model.get('email') }),
        callback: function(confirmed) {
          if(!confirmed) {
            return;
          }

          var $btn = $(e.target);
          $btn.addClass('submitted');
          Helpers.ajax('api/user/invite', { email: this.model.get('email') }, 'POST', function() {
            $btn.removeClass('submitted');
          });
        }.bind(this)
      });
    },

    onResetPasswordClicked: function(e) {
      var self = this;
      Origin.Notify.confirm({
        text: Origin.l10n.t('app.confirmsendreset', { email: this.model.get('email') }),
        callback: function(confirmed) {
          if (!confirmed) {
            return;
          };
          var $btn = $(e.currentTarget);
          $btn.addClass('submitted');
          Helpers.ajax('api/createtoken', { email: this.model.get('email') }, 'POST', function() {
            self.model.fetch();
            $btn.removeClass('submitted');
          });
        }.bind(this)
      });
    },

    onChangePasswordClicked: function() {
      var self = this;
      var genericId = 'UserManagementResetModal';
      this.model.set('fieldId', 'password');
      var passwordFieldsView = PasswordFieldsView({ model: this.model, genericId: genericId });
      var passwordToSave = '';
      var confirmPasswordToSave =  '';
      Origin.Notify.alert({
        type: 'warning',
        html: passwordFieldsView.el,
        showConfirmButton: true,
        closeOnConfirm: false,
        allowOutsideClick: false,
        confirmButtonText: Origin.l10n.t('app.save'),
        showCancelButton: true,
        cancelButtonText: Origin.l10n.t('app.cancel'),
        preConfirm: function(e) {
          var passwordVal = passwordFieldsView.$el.find(`#password${genericId}`)[0].value;
          var confirmPasswordVal = passwordFieldsView.$el.find(`#confirmPassword${genericId}`)[0].value;

          var passwordErrors = PasswordHelpers.validatePassword(passwordVal);
          var isConfirmPasswordValid = PasswordHelpers.validateConfirmationPassword(passwordVal, confirmPasswordVal);

          passwordToSave = passwordVal;
          confirmPasswordToSave = confirmPasswordVal;

          var shouldConfirm = passwordErrors.length == 0 && isConfirmPasswordValid;

          var errorHash = {};

          errorHash['password'] = passwordErrors.length > 0 ? `${Origin.l10n.t('app.passwordindicatormedium')}` : '';

          errorHash['confirmPassword'] = !isConfirmPasswordValid ? `${Origin.l10n.t('app.confirmpasswordnotmatch')}` : '';

          self.model.trigger('invalid', self.model, errorHash);

          if (!shouldConfirm) return false;

          var toChange = {
            email: self.model.get('email'),
            password: passwordVal
          };

          $.ajax({
            url: 'api/user/resetpassword',
            method: 'POST',
            data: toChange,
            async: false,
            success: function () {
              Origin.Notify.alert({
                type: 'success',
                text: Origin.l10n.t('app.changepasswordtext', { email: self.model.get('email') })
              });
              shouldConfirm = true;
            },
            error: function (error) {
              // for server error messages - will remove in future
              var errMsg = CHelpers.translateData(error);
              passwordFieldsView.$el.find(`#passwordError${genericId}`).html(errMsg);
              passwordFieldsView.$el.find(`#confirmPasswordError${genericId}`).html('');
              shouldConfirm = false;
            }
          });

          return shouldConfirm;
        },
        callback: function(isConfirm) {
          if (isConfirm) {
            Origin.Notify.alert({
              type: 'success',
              text: Origin.l10n.t('app.changepasswordtext', { email: self.model.get('email') })
            });
            self.model.fetch();
          }
        }
      });
      // Origin.Notify.confirm({
      //   type: 'input',
      //   title: Origin.l10n.t('app.resetpasswordtitle'),
      //   text: Origin.l10n.t('app.resetpasswordinstruction', { email: this.model.get('email') }),
      //   inputType: 'password',
      //   confirmButtonText: 'Save',
      //   closeOnConfirm: false,
      //   callback: function(newPassword) {
      //     if(newPassword === false) return;
      //     else if(newPassword === "") return swal.showInputError(Origin.l10n.t('app.invalidempty'));
      //     var postData = {
      //       "email": self.model.get('email'),
      //       "password": newPassword
      //     };
      //     Helpers.ajax('api/user/resetpassword', postData, 'POST', function() {
      //       self.model.fetch();
      //       Origin.Notify.alert({
      //         type: 'success',
      //         text: Origin.l10n.t('app.changepasswordtext', { email: self.model.get('email') })
      //       });
      //     });
      //   }
      // });
    },

    onDisableClicked: function() {
      this.updateModel({ _isDeleted: true});
    },

    onRestoreClicked: function() {
      this.updateModel({ _isDeleted: false});
    },

    onDeleteClicked: function() {
      var option = this.$('[name="delete-options"]').val();
      var optionMsg = {
        transfer: Origin.l10n.t('app.confirmdeleteusertransfer'),
        delete: Origin.l10n.t('app.confirmdeleteuserdelete'),
        share: Origin.l10n.t('app.confirmdeleteusershare')
      };
      var self = this;
      Origin.Notify.confirm({
        type: 'confirm',
        text: Origin.l10n.t('app.confirmdeleteuser', {
          courseOption: optionMsg[option],
          email: this.model.get('email')
        }),
        callback: function(confirmed) {
          if(confirmed) {
            self.model.destroy({
              data: {
                userCourseOption: option
              },
              processData: true,
              error: self.onError
            });
          }
        }
      });
    },

    onTransferClicked: function() {
      var self = this;
      var courseTransferFieldsView = CourseTransferFieldsView({model: this.model});
      Origin.Notify.alert({
        type: 'warning',
        html: courseTransferFieldsView.el,
        showConfirmButton: true,
        showCancelButton: true,
        confirmButtonText: Origin.l10n.t('app.confirmdefaultyes'),
        cancelButtonText: Origin.l10n.t('app.cancel'),
        closeOnConfirm: false,
        allowOutsideClick: false,
        preConfirm: function(e) {
          var transferTo = self.model.get('transferTo');
          if (!transferTo) {
            self.model.trigger('invalid', self.model, {"courseTransfer": `${Origin.l10n.t('app.userrequired')}`});
            return false;
          }
        },
        callback: function(confirmed) {
          if(confirmed) {
            $.ajax({
              url: `api/transfer_all_courses_ownership/from_user/${self.model.get('_id')}/to_user/${self.model.get('transferTo')}`,
              method: 'PATCH',
              async: false,
              success: function () {
                Origin.Notify.alert({ type: 'success', text: Origin.l10n.t('app.transfersuccess') });
              },
              error: function (error) {
                Origin.Notify.alert({ type: 'error', text: error.responseText});
              }
            });
          }
        }
      });
    },

    updateModel: function(changes) {
      var self = this;
      this.model.save(changes, {
        patch: true,
        wait: true,
        error: function(model, response, options) {
          var errorCode = response.responseJSON && response.responseJSON.code;
          var errorMessage = response.responseText;
          switch(errorCode) {
            // duplicate key
            case 11000:
              return self.onError(Origin.l10n.t('app.duplicateuservalueerror', changes));
            default:
              return self.onError(Origin.l10n.t('app.uservalueerror') + ' (' + errorMessage + ')');
          }
        }
      });
    },

    onError: function(error) {
      /**
      * HACK setTimeout to make sure the alert opens.
      * If we've come straight from a confirm, sweetalert will still be cleaning
      * up, and won't show.
      */
      setTimeout(function() {
        Origin.Notify.alert({
          type: 'error',
          text: error.message || error
        });
      }, 100);
    }
  }, {
    template: 'user'
  });

  return UserView;
});
