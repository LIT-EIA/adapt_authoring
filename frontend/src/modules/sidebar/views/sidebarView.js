// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {

  var Origin = require('core/origin');
  var OriginView = require('core/views/originView');
  var SidebarFilterView = require('./sidebarFilterView');

  var Sidebar = OriginView.extend({

    className: 'sidebar',

    initialize: function () {
      var prevWidth = $(window).width();
      this.model.set('prevWidth', prevWidth);
      const isMobile = prevWidth <= 450;
      this.model.set('_icon', isMobile ? 'fa-chevron-circle-right' : 'fa-chevron-circle-left');
      this.model.set('_displayNone', isMobile);
      if (isMobile) {
        $('#content_wrapper').addClass('folded');
      }
      this.render();
      this.setEvents();
    },

    setEvents: function () {
      var prevWidth = this.model.get('prevWidth');
      var that = this;
      $(window).resize(function () {
        var currentWidth = $(window).width();
        if ((prevWidth <= 450 && currentWidth > 450) || (prevWidth > 450 && currentWidth <= 450)) {
          const shouldToggleExpanded = currentWidth <= 450;
          that.toggleSidebar(shouldToggleExpanded ? 'expanded' : 'folded');
          prevWidth = currentWidth;
        }
      });
      this.$el.find('.collapse-sidebar').on('click', this.toggleSidebar);
      this.listenTo(Origin, 'sidebar:sidebarContainer:update', this.updateViews);
      this.listenTo(Origin, 'sidebar:sidebarFilter:add', this.addFilterView);
      this.listenTo(Origin, 'sidebar:sidebarContainer:hide', this.hideSidebar);
    },

    updateViews: function ($element, options) {
      $('html').removeClass('sidebar-hide');

      // Check if options exists
      var options = (options || {});

      // If backButton option setup backButton
      if (options.backButtonText && options.backButtonRoute) {
        this.setupBackButtonRoute(options);
      } else {
        this.removeBackButtonRoute();
      }

      // Append new view into sidebar
      // Append is better here so we can animate the current view out
      this.$('.sidebar-item-container').append($element);

    },

    hideSidebar: function () {
      $('html').addClass('sidebar-hide');
    },

    setupBackButtonRoute: function (options) {
      // If breadcrumb, render template and animate in
      var template = Handlebars.templates['sidebarBreadcrumb'];
      this.$('.sidebar-breadcrumb').html(template(options));
      _.defer(function () {
        this.$('.sidebar-breadcrumb').velocity({ 'top': '0px', 'opacity': 1 }, function () {
          Origin.trigger('sidebar:views:animateIn');
        });
      });
    },

    removeBackButtonRoute: function () {
      // If breadcrumb needs removing, animate out and trigger animateIn for the new view
      this.$('.sidebar-breadcrumb').velocity({ 'top': '-40px', 'opacity': 0 }, function () {
        $(this).empty();
        Origin.trigger('sidebar:views:animateIn');
      });
    },

    addFilterView: function (options) {
      Origin.trigger('sidebar:sidebarFilter:remove');
      $('body').append(new SidebarFilterView(options).$el);
    },

    toggleSidebar: function (type) {
      var contentWrapper = $('#content_wrapper');
      var collapseButton = $('.collapse-sidebar');
      var collapseIcon = $('.collapse-sidebar i');
      var sidebarInner = $('.sidebar-inner');

      var isFolded = type === 'folded' || contentWrapper.hasClass('folded');
      var newIconClass = isFolded ? 'fa-chevron-circle-left' : 'fa-chevron-circle-right';
      var newOpacity = isFolded ? 1 : 0;

      if (isFolded) {
        sidebarInner.removeClass('display-none');
        contentWrapper.removeClass('folded');
        collapseButton.attr('aria-expanded', 'true');
      } else {
        contentWrapper.addClass('folded');
        collapseButton.attr('aria-expanded', 'false');
      }
      collapseIcon.removeClass('fa-chevron-circle-left fa-chevron-circle-right').addClass(newIconClass);

      sidebarInner.velocity({
        'left': '0%',
        'opacity': newOpacity
      }, {
        duration: 200,
        easing: "easeOutQuad",
        complete: function () {
          if (!isFolded) {
            var that = this;
            setTimeout(function () {
              window.dispatchEvent(new Event('resize'));
              $(that).addClass('display-none');
            }, 250);
          }
        }
      });
    }
  }, {
    template: 'sidebar'
  });

  return Sidebar;

});
