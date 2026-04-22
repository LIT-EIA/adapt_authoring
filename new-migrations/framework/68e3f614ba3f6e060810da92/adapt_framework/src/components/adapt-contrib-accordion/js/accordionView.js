define([
    'core/js/views/componentView'
], function(ComponentView) {

    var AccordionView = ComponentView.extend({

        events: {
            'click .accordion-item-title': 'onClick'
        },

        preRender: function() {
            this.checkIfResetOnRevisit();

            this.model.resetActiveItems();

            this.listenTo(this.model.get('_children'), {
                'change:_isActive': this.onItemsActiveChange,
                'change:_isVisited': this.onItemsVisitedChange
            });
        },

        postRender: function() {
            this.setReadyStatus();

            if (this.model.get('_setCompletionOn') === 'inview') {
                this.setupInviewCompletion();
            }
        },

        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
            }
        },

        onClick: function(event) {
            event.preventDefault();

            this.model.toggleItemsState($(event.currentTarget).parent().data('index'));
        },

        onItemsActiveChange: function(item, isActive) {
            this.toggleItem(item, isActive);
        },

        onItemsVisitedChange: function(item, isVisited) {
            if (!isVisited) return;

            var $item = this.getItemElement(item);

            $item.children('.accordion-item-title').addClass('visited');
        },

        toggleItem: function(item, shouldExpand) {
            var $item = this.getItemElement(item);
            var $body = $item.children('.accordion-item-body').stop(true, true);

            $item.children('.accordion-item-title')
                .toggleClass('selected', shouldExpand)
                .attr('aria-expanded', shouldExpand);
            $item.find('.accordion-item-title-icon')
                .toggleClass('icon-plus', !shouldExpand)
                .toggleClass('icon-minus', shouldExpand);

            if (!shouldExpand) {
                $body.slideUp(this.model.get('_toggleSpeed'));
                return;
            }

            $body.slideDown(this.model.get('_toggleSpeed'));
        },

        getItemElement: function(item) {
            var index = item.get('_index');

            return this.$('.accordion-item').filter('[data-index="' + index +'"]');
        }

    });

    return AccordionView;

});
