define([ 'core/origin', 'backbone-forms', './scaffoldUsersView' ], function(Origin, BackboneForms, ScaffoldUsersView) {
  var ScaffoldSingleUserView = ScaffoldUsersView.extend({
    tagName: 'input',
    className: 'scaffold-users',
    idField: 'email',

    initSelectize: function(users) {
      this.setValue(this.value);

      this.$el.selectize({
        labelField: 'email',
        valueField: '_id',
        options: users,
        maxItems: 1,
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
    Origin.scaffold.addCustomField('SingleUser', ScaffoldSingleUserView);
  });

  return ScaffoldSingleUserView;

});
