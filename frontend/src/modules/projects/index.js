// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Origin = require('core/origin');
  var ProjectsView = require('./views/projectsView');
  var ProjectsSidebarView = require('./views/projectsSidebarView');
  var AllProjectCollection = require('./collections/allProjectCollection');
  var MyProjectCollection = require('./collections/myProjectCollection');
  var SharedProjectCollection = require('./collections/sharedProjectCollection');
  var TagsCollection = require('core/collections/tagsCollection');

  Origin.on('router:dashboard', function(location, subLocation, action) {
    Origin.trigger('editor:resetData');
    Origin.options.addItems([
      {
        title: Origin.l10n.t('app.grid'),
        icon: 'th',
        callbackEvent: 'dashboard:layout:grid',
        value: 'grid',
        group: 'layout',
      },
      {
        title: Origin.l10n.t('app.list'),
        icon: 'list',
        callbackEvent: 'dashboard:layout:list',
        value: 'list',
        group: 'layout'
      },
      {
        title: Origin.l10n.t('app.ascending'),
        icon: 'sort-alpha-asc',
        callbackEvent: 'dashboard:sort:asc',
        value: 'asc',
        group: 'sort'
      },
      {
        title: Origin.l10n.t('app.descending'),
        icon: 'sort-alpha-desc',
        callbackEvent: 'dashboard:sort:desc',
        value: 'desc',
        group: 'sort'
      },
      {
        title: Origin.l10n.t('app.recent'),
        icon: 'edit',
        callbackEvent: 'dashboard:sort:updated',
        value: 'updated',
        group: 'sort'
      }
    ]);

    var tagsCollection = new TagsCollection();

    tagsCollection.fetch({
      success: function() {
        Origin.sidebar.addView(new ProjectsSidebarView({ collection: tagsCollection }).$el);
        Origin.trigger('dashboard:loaded', { type: location || 'own' });
      },
      error: function() {
        console.log('Error occured getting the tags collection - try refreshing your page');
      }
    });
  });

  Origin.on('dashboard:loaded', function (options) {
    // Check if options exist and the type is valid
    if (!options || !['all', 'own', 'shared'].includes(options.type)) {
      return;
    }

    const type = options.type;

    // Map type to title key and collection
    const typeMappings = {
      all: { titleKey: 'allprojects', Coll: AllProjectCollection },
      shared: { titleKey: 'sharedprojects', Coll: SharedProjectCollection },
      default: { titleKey: 'myprojects', Coll: MyProjectCollection }
    };
    const { titleKey, Coll } = typeMappings[type] || typeMappings.default;

    // Data for permissions check
    const data = {
      featurePermissions: ["{{tenantid}}/content/*:read"]
    };

    // Block user access if required permissions are not met
    if (type === 'all' && !Origin.permissions.hasPermissions(data.featurePermissions)) {
      Origin.router.blockUserAccess();
      return;
    }

    // Set the view and update the title
    Origin.contentPane.setView(ProjectsView, { collection: new Coll(), _isShared: type === 'shared' });
    Origin.trigger('location:title:update', { breadcrumbs: ['dashboard'], title: Origin.l10n.t(`app.${titleKey}`) });
  });

  Origin.on('globalMenu:dashboard:open', function() {
    Origin.router.navigateTo('dashboard');
  });

  Origin.on('origin:dataReady login:changed', function() {
    Origin.router.setHomeRoute('dashboard');
    Origin.globalMenu.addItem({
      "location": "global",
      "text": Origin.l10n.t('app.dashboard'),
      "icon": "fa-home",
      "callbackEvent": "dashboard:open",
      "sortOrder": 1
    });
  });
});
