define([ 'core/origin', 'backbone-forms', './scaffoldUsersView' ], function(Origin, BackboneForms, ScaffoldUsersView) {
  var ScaffoldUsersWithEmailView = ScaffoldUsersView.extend({
    tagName: 'input',
    className: 'scaffold-users',
    idField: 'email',

    renderItem: function(item, escape) {
      return Handlebars.templates.scaffoldUsersWithEmailOption({
        name: item.firstName && item.lastName ? escape(item.firstName  + ' ' +  item.lastName) : false,
        email: escape(item.email),
        disabled: item.disabled
      });
    },

    initSelectize: function(users) {
      this.setValue(this.value);

      this.$el.selectize({
        labelField: 'email',
        valueField: 'email',
        options: users,
        searchField: [ 'email', 'firstName', 'lastName' ],
        render: {
          item: this.renderItem,
          option: this.renderItem
        },
        onItemRemove: function(value, $item) {
          if(value !== Origin.sessionModel.get('id')) {
            return;
          }
          Origin.Notify.alert({
            type: 'warning',
            text: Origin.l10n.t('app.stopsharingwithyourself')
          });
          this.addItem(value, true);
          this.close();
        }
      });
    }
  });

  Origin.on('origin:dataReady', function() {
    Origin.scaffold.addCustomField('UsersWithEmail', ScaffoldUsersWithEmailView);
  });

  return ScaffoldUsersWithEmailView;

});
