// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Backbone = require('backbone');
  var Origin = require('core/origin');
  var ContextMenuView = require('./views/contextMenuView');

  // Public API
  Origin.contextMenu = ContextMenu = {
    addItem: function(type, contextMenuObject) {
      if (contextMenuObject.length > 1) {
        _.each(contextMenuObject, function (object) {
          object.type = type;
          menuItems.add(object);
        });
      } else {
        contextMenuObject.type = type;
        menuItems.add(contextMenuObject);
      }
    }
  };

  Origin.on('origin:dataReady login:changed', init);
  Origin.on('reinitializeContextMenu', reinitializeContextMenu);

  // Privates

  var menuItems;
  var view;

  function init() {
    menuItems = new Backbone.Collection();
    setUpMenuItems();

    if(view) view.remove();
    view = new ContextMenuView({ collection: menuItems });
  };

  function reinitializeContextMenu() {
    if (view) view.remove();
    view = new ContextMenuView({ collection: menuItems });
  }

  function setUpMenuItems() {
    ContextMenu.addItem('article', getDefaultItems(['transferCourse']));
    ContextMenu.addItem('block', getDefaultItems(['transferCourse']));
    ContextMenu.addItem('component', getDefaultItems(['transferCourse']));
    ContextMenu.addItem('page', [
      {
        title: Origin.l10n.t('app.editpagestructure'),
        className: 'context-menu-item',
        callbackEvent: "pageStructure"
      },
      {
        title: Origin.l10n.t('app.editpagesettings'),
        className: 'context-menu-item',
        callbackEvent: "edit"
      },
      ...getDefaultItems(['edit', 'transferCourse'])]
    );
    ContextMenu.addItem('menu', getDefaultItems(['copy','transferCourse']));
    ContextMenu.addItem('page-min', getDefaultItems(['copy','delete','colorLabel','transferCourse']));
    ContextMenu.addItem('course', getDefaultItems(['colorLabel']));
  };

  /*
  * returns the default list excluding anything in [blacklist] (uses callbackEvent to filter)
  */
  function getDefaultItems(blacklist) {
    var DEFAULT_ITEMS = [
      {
        title: Origin.l10n.t('app.edit'),
        className: 'context-menu-item',
        callbackEvent: "edit"
      },
      {
        title: Origin.l10n.t('app.copy'),
        className: 'context-menu-item',
        callbackEvent: "copy"
      },
      {
        title: Origin.l10n.t('app.copyidtoclipboard'),
        className: 'context-menu-item',
        callbackEvent: "copyID"
      },
      {
        title: Origin.l10n.t('app.delete'),
        className: 'context-menu-item',
        callbackEvent: "delete"
      },
      {
        title: Origin.l10n.t('app.colourLabel'),
        className: 'context-menu-item',
        callbackEvent: "colorLabel"
      },
      {
        title: Origin.l10n.t('app.transfersinglecourseownershipto'),
        className: 'context-menu-item',
        callbackEvent: "transferCourse"
      }
    ];
    if(!blacklist) {
      return DEFAULT_ITEMS;
    }
    return _.filter(DEFAULT_ITEMS, function(item) {
      return blacklist.indexOf(item.callbackEvent) < 0;
    });
  };
});
