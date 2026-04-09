// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Backbone = require('backbone');
  var Origin = require('core/origin');
  var ContextMenuItemView = require('./contextMenuItemView');

  var ContextMenuView = Backbone.View.extend({
    className: 'context-menu',
    contextView : {},

    initialize: function() {
      this._isVisible = false;
      this.listenTo(Origin, {
        'contextMenu:open': this.toggleMenu,
        'contextMenu:closeContextMenu remove remove:views': this.hideMenu
      });
      $('html').click(_.bind(this.hideMenu, this));
      this.render();
    },

    render: function() {
      var template = Handlebars.templates['contextMenu'];
      $(this.el).html(template).appendTo('body');
      return this;
    },

    renderItems: function() {
      this.$('.context-menu-holder').empty();
      Origin.trigger('contextMenu:empty');

      _.each(this.collection.where({ type: this.type }), function(item) {
        item.set('contextView', this.contextView);
        new ContextMenuItemView({ model: item });
      }, this);
    },

    toggleMenu: function(view, e, opts) {
      this.view = view;
      this.contextMenuType = opts && opts.type ? opts.type : '';
      this.menuCss = opts && opts.menuCss ? opts.menuCss : null;
      this.containerClassName = opts ? opts.containerClassName : null;
      var isSameType = view && (view.model.get('_type')) === (this.contextView.model && this.contextView.model.get('_type'));
      var isSameModel = view && (view.model.get('_id')) === (this.contextView.model && this.contextView.model.get('_id'));
      var isSameView = view.cid === this.contextView.cid; // to make sure we don't break listeners
      // new view, update the menu items
      if(!isSameType || !isSameModel || !isSameView) {
        this.setMenu(opts && opts.fakeView ? opts.fakeView : view, $(e.currentTarget));
        return this.showMenu();
      }
      (this._isVisible) ? this.hideMenu() : this.showMenu();
    },

    setMenu: function(view, $parent) {
      this.contextView = view;
      this.type = view.model.get('_type');

      this.renderItems();

      this.$el.css({
        position: 'absolute',
        left: $parent.offset().left + $parent.width() + 10,
        top: $parent.offset().top - ($parent.height()/2)
      });
    },

    showMenu: function() {
      this.$el.removeClass('display-none');
      this._isVisible = true;
      var contextMenuIconClassName = this.contextMenuType ? `open-${this.contextMenuType}-context-menu-icon` : 'open-context-menu-icon';
      var contextMenuContainerClassName = this.contextMenuType ? `${this.contextMenuType}-context-menu-container` : 'context-menu-container';
      Origin.trigger('contextMenu:opened');
      if (this.view && this.containerClassName) {
        this.view.$el.find(`.${contextMenuIconClassName}`).attr('aria-expanded', 'true');
        this.view.$el.find(`.${contextMenuContainerClassName}`).html(this.$el);
        this.$el.css(this.menuCss ? this.menuCss : {
          left: '30px',
          top: 0
        });
        var self = this;
        Origin.trigger('startkeyboardtrap', { $el: self.view.$el.find(`.${self.containerClassName}`) });
      }
    },

    hideMenu: function() {
      var contextMenuIconClassName = this.contextMenuType ? `open-${this.contextMenuType}-context-menu-icon` : 'open-context-menu-icon';
      if (this.view && this.containerClassName) {
        this.view.$el.find(`.${contextMenuIconClassName}`).off('keydown');
        Origin.trigger('stopkeyboardtrap', { $el: this.view.$el.find(`.${this.containerClassName}`) });
        this.view.$el.find(`.${contextMenuIconClassName}`).attr('aria-expanded', 'false');
      }
      $('.block').removeClass('expanded-context-menu')
      this.$el.addClass('display-none');
      this._isVisible = false;
      Origin.trigger('contextMenu:closed');
    },
  });

  return ContextMenuView;
});
