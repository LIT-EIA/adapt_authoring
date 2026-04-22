define([
    'core/js/models/itemsComponentModel'
], function(ItemsComponentModel) {

    var AccordionModel = ItemsComponentModel.extend({

        defaults: function() {
            return _.extend({}, _.result(ItemsComponentModel.prototype, 'defaults'), {
                _shouldCollapseItems: true,
                _toggleSpeed: 200
            });
        },

        toggleItemsState: function(index) {
            var item = this.getItem(index);
            var previousActiveItem = this.getActiveItem();

            item.toggleActive();
            item.toggleVisited(true);

            if (previousActiveItem && this.get('_shouldCollapseItems')) {
                previousActiveItem.toggleActive(false);
            }
        }

    });

    return AccordionModel;

});
