define([
  'core/js/adapt',
  'core/js/views/componentView'
], function (Adapt, ComponentView) {
  'use strict';

  var GuidedTourView = ComponentView.extend({

    events: {
      'click .start-tour': 'onStartTour'
    },

    initialize: function () {
      ComponentView.prototype.initialize.call(this);
      this.checkIfResetOnRevisit();
      this.scrollToPositionBound = this.scrollToPosition.bind(this);
      this.listenTo(Adapt, 'device:changed', this.reRender);
      this.listenTo(Adapt, 'device:resize', this.setStartButton);
    },
    reRender: function () {
      if (Adapt.device.screenSize !== 'large') {
        this.replaceWithNarrative();
      }
    },

    replaceWithNarrative: function () {
      this.stopListening(Adapt, 'device:resize', this.scrollToPositionBound);
      var NarrativeView = Adapt.getViewClass('narrative');

      var model = this.prepareNarrativeModel();
      var newNarrative = new NarrativeView({ model: model });
      var $container = $(".component-container", $("." + this.model.get("_parentId")));

      newNarrative.reRender();
      newNarrative.setupNarrative();
      $container.html(newNarrative.$el);
      //Adapt.trigger('device:resize');
      _.defer(this.remove.bind(this));
    },

    prepareNarrativeModel: function () {
      var model = this.model;
      model.set({
        '_component': 'narrative',
        '_wasGuidedtour': true,
        'originalBody': model.get('body'),
        'originalInstruction': model.get('instruction')
      });

      // Check if active item exists, default to 0
      var activeItem = model.getActiveItem();
      if (!activeItem) {
        model.getItem(0).toggleActive(true);
      }

      // Swap mobile body and instructions for desktop variants.
      if (model.get('mobileBody')) {
        model.set('body', model.get('mobileBody'));
      }
      if (model.get('mobileInstruction')) {
        model.set('instruction', model.get('mobileInstruction'));
      }

      return model;
    },

    checkIfResetOnRevisit: function () {
      var isResetOnRevisit = this.model.get('_isResetOnRevisit');

      // If reset is enabled set defaults
      if (isResetOnRevisit) {
        this.model.reset(isResetOnRevisit);
      }
    },

    preRender: function () {
      this.steps = this.model.get('_items');
      if (this.steps && this.steps.length >= 2) {
        this.model.set('active', true);
        var offsetValue = Adapt.config.get("_scrollingContainer")._isEnabled ? 64 : 0;
        this.model.set('offsetValue', offsetValue);
        this.steps.forEach(function (step, index) {
          var img = new Image();
          img.src = step._graphic.src;
        });
        const globals = Adapt.course.get('_globals');
        var guidedtour = globals._components._guidedtour;
        this.model.set('guidedtour', guidedtour);

        var componentModel = this.model;
        var blockModel = Adapt.findById(componentModel.get("_parentId"));
        var articleModel = Adapt.findById(blockModel.get("_parentId"));

        var models = [componentModel, blockModel, articleModel];
        var titleLevel = 1;

        models.forEach(function (model) {
          if (model.get('displayTitle').length >= 1) {
            titleLevel++;
          }
        })
        this.model.set('_ariaLevel', (titleLevel + 1))
      }

      if (Adapt.device.screenSize === 'large') {
        this.render();
      } else {
        this.reRender();
      }

    },

    postRender: function () {
      var self = this;
      if (this.model.get('active')) {
        var initialImage = this.$el.find('.guidedtour-graphic img');
        if(initialImage){
          self.setStartButton();
        }
        initialImage.on('load', function () {
          self.setStartButton();
        });
        var guidedtour = this.model.get('guidedtour');
        this.componentID = this.$el.attr('data-adapt-id');

        this.tour = new Shepherd.Tour({
          defaultStepOptions: {
            cancelIcon: {
              enabled: true
            },
            scrollTo: false
          },
          keyboardNavigation: false
        });


        this.verifyCompletion = function () {
          if (Object.values(this.steps).every(step => step.inView === true)) {
            this.setCompletionStatus();
          }
        };

        this.previousStep = function (tour, stepIndex) {
          var loading = this.$el.find('.loading-step')[0];
          loading.focus({ preventScroll: true });
          var step = this.steps[stepIndex];
          this.loadImage(step).then(() => {
            tour.back();
          }
          );
        };

        this.nextStep = function (tour, stepIndex) {
          var loading = this.$el.find('.loading-step')[0];
          loading.focus({ preventScroll: true });
          this.steps[stepIndex].inView = true;
          var step = this.steps[stepIndex];
          this.loadImage(step).then(() => {
            tour.next();
          }
          );
        };

        this.loadImage = function (step) {
          return new Promise((resolve, reject) => {
            var self = this;
            const wrapper = this.$el.find('.guidedtour-graphic');
            const img = this.$el.find(`.guidedtour-graphic img`)[0];
            var fullWidth = step._graphic._forceFullWidth ? true : false;
            img.onload = () => {
              wrapper.toggleClass('full-width', fullWidth);
              resolve(img);
            }
            img.onerror = reject;
            img.src = step._graphic.src;
          })
        };


        this.tour.on('cancel', function (e) {
          self.stopListening(Adapt, 'device:resize', self.scrollToPositionBound);
          self.loadImage(self.steps[0]).then(() => {
            self.scrollToPositionBound();
            self.$el.find('.guidedtour-graphic img').addClass('tour-disabled');
            self.$el.find('.start-tour.active-button').removeClass('display-none');
            var button = self.$el.find('.start-tour.active-button')[0];
            button.focus({preventScroll: true});
            self.verifyCompletion();
          })
        });

        this.tour.on('start', function (e) {
          self.listenTo(Adapt, 'device:resize', self.scrollToPositionBound);
        });

        this.steps.forEach(function (step, index) {

          var templateTitle = Handlebars.templates['stepTitle'];

          var templateOptions = {
            title: step.title,
            itemNumber: index + 1,
            totalItems: self.steps.length,
            ariaLevel: self.model.get('_ariaLevel'),
            hidePagination: self.model.get('_hidePagination')
          };

          var templatePagination = Adapt.course.get("_globals")._components._guidedtour.stepPagination || '{{itemNumber}} / {{totalItems}}';
          templateOptions.paginationLabel = Handlebars.compile(templatePagination)(templateOptions);

          var templatePaginationAria = Adapt.course.get("_globals")._components._guidedtour.stepPaginationAria || 'Step {{itemNumber}} of {{totalItems}}';
          templateOptions.paginationAria = Handlebars.compile(templatePaginationAria)(templateOptions);

          var stepObject = {
            title: templateTitle(templateOptions),
            text: `<img src="${step._graphic.src}" class="sr-only" alt="${step._graphic.alt}"/>${step.body}`,
            classes: !step._pin._bordercolor || step._pin._bordercolor === 'rgba(0, 0, 0, 0)' ? 'no-border' : 'border',
            buttons: [
              {
                action() {
                  return index === 0 ? self.tour.cancel() : self.previousStep(this, (index - 1));
                },
                classes: 'shepherd-button-secondary',
                text: index === 0 ? guidedtour.closeText : guidedtour.previousText
              },
              {
                action() {
                  return index === (self.steps.length - 1) ? self.tour.cancel() : self.nextStep(this, (index + 1));
                },
                text: index === (self.steps.length - 1) ? guidedtour.closeText : guidedtour.nextText
              }
            ],
            id: `step-${index}-${self.componentID}`,
            attachTo: {
              element: `div[data-adapt-id="${self.componentID}"] .tour-item-${index}`,
              on: step._pin._bubbledirection !== 'none' ? step._pin._bubbledirection : 'bottom'
            },
            arrow: step._pin._bubbledirection !== 'none',
            borderColor: step._pin._bordercolor,
            when: {
              show: function () {
                var dialog = $(this.el);
                dialog.addClass(`step-${index}-${self.componentID}`);
                $(":root")[0].style.setProperty("--shepherd-border-color", this.options.borderColor);
                self.scrollToPositionBound()
              }
            }
          }
          self.tour.addStep(stepObject);
        })
      }
      this.$('.guidedtour-widget').imageready(this.setReadyStatus.bind(this));
      if (this.model.get('_setCompletionOn') === 'inview') {
        this.setupInviewCompletion('.component-widget');
      }
    },

    remove: function () {
      if (this.model.get('active') && this.tour) {
        this.tour.complete();
      }
      Backbone.View.prototype.remove.call(this);
    },

    setStartButton: function () {
      var img = this.$el.find('.guidedtour-graphic img');
      var navHeight = $('.navigation').height();
      var win = $(window);
      var winHeight = win.height();
      var viewHeight = winHeight + navHeight;
      var imgHeight = img.outerHeight(true);
      var imageBiggerThanView = imgHeight > (viewHeight - navHeight);
      if (imageBiggerThanView) {
        this.$el.find('.guidedtour-widget .top-button').toggleClass('active-button', true);
        this.$el.find('.guidedtour-graphic .over-button').toggleClass('active-button', false);
      } else {
        this.$el.find('.guidedtour-graphic .over-button').toggleClass('active-button', true);
        this.$el.find('.guidedtour-widget .top-button').toggleClass('active-button', false);
      }
    },

    onStartTour: function () {
      this.steps[0].inView = true;
      var self = this;
      _.delay(function () {
        self.$el.find('.start-tour').addClass('display-none');
        self.$el.find('.guidedtour-graphic img').removeClass('tour-disabled');
        self.tour.start();
      }, 300)
    },

    scrollToPosition: function () {
      var self = this;
      var tour = self.tour;
      var currentStep = tour.getCurrentStep();
      var stepId = currentStep.id;
      _.delay(function () {
        var stepElem = $(`.shepherd-element.${stepId}`);
        var img = self.$el.find('.guidedtour-graphic img');
        var navHeight = $('.navigation').height();
        var win = $(window);
        var winScrollTop = win.scrollTop();
        var winHeight = win.height();
        var viewHeight = winHeight + navHeight;
        var imgOffset = img.offset();
        var imgHeight = img.outerHeight(true);
        var imgTop = imgOffset.top;
        var imgBottom = imgTop + imgHeight;
        var centerImg = imgTop + (imgHeight / 2) - (viewHeight / 2);
        var imgInView = imgTop > winScrollTop + navHeight && imgBottom < winScrollTop + winHeight;
        var imageBiggerThanView = imgHeight > (viewHeight - navHeight);
        var instructions = self.$el.find('.guidedtour-instruction-inner');
        var instructionsExist = instructions.length > 0;

        if (stepElem.length > 0) {
          var stepOffset = stepElem.offset();
          var stepHeight = stepElem.outerHeight(true);
          var stepTop = stepOffset.top;
          var stepBottom = stepTop + stepHeight;
          var imgNotCentered = centerImg !== winScrollTop;
          var imgLowerThanView = imgBottom > winScrollTop + winHeight;
          var imgHigherThanView = imgTop < winScrollTop + navHeight;
          var stepHigherThanImg = stepTop < imgTop;
          var stepLowerThanImg = stepBottom > imgBottom;
          var viewLowerThanStep = winScrollTop + navHeight > stepTop;
          var viewHigherThanStep = winScrollTop + winHeight < stepBottom;
          var stepInsideImg = imgTop < stepTop && imgBottom > stepBottom;
          var centerStep = stepTop + (stepHeight / 2) - navHeight;
          var viewOnCenterStep = centerStep - (viewHeight / 2) + navHeight;
          var nearBottom = (imgBottom - centerStep) < (viewHeight / 2) + navHeight;
          var nearTop = (centerStep - imgTop) < (viewHeight / 2) + navHeight;
          var viewOnImageBottom = imgBottom - (viewHeight - navHeight);
          var viewOnImageTop = imgTop - navHeight;
          var offsetValue = self.model.get('offsetValue');
          if (stepLowerThanImg && ((viewHigherThanStep || imgHigherThanView) || (imageBiggerThanView && viewHigherThanStep))) {
            var target = (stepBottom - winHeight);
            var distance = Math.abs(target - winScrollTop);
            var duration = Math.max(Math.min(distance / 1.5, 1000), 350);
            Adapt.scrollTo(`${target + offsetValue }`, { offset: { top:  0 }, duration: duration });
            //console.log('bottom of step!')
          } else if (stepHigherThanImg && ((viewLowerThanStep || imgLowerThanView) || (imageBiggerThanView && viewLowerThanStep))) {
            var target = (stepTop - navHeight);
            var distance = Math.abs(target - winScrollTop);
            var duration = Math.max(Math.min(distance / 1.5, 1000), 350);
            Adapt.scrollTo(`${target + offsetValue }`, { offset: { top:  0 }, duration: duration });
            //console.log('top of step!')
          } else if (stepInsideImg && imageBiggerThanView) {
            if (nearBottom) {
              //console.log('bottom of image!');
              var target = viewOnImageBottom;
              var distance = Math.abs(target - winScrollTop);
              var duration = Math.max(Math.min(distance / 1.5, 1000), 350);
              Adapt.scrollTo(`${target + offsetValue }`, { offset: { top:  0 }, duration: duration });
            } else if (nearTop) {
              //console.log('top of image!');
              var target = viewOnImageTop;
              var distance = Math.abs(target - winScrollTop);
              var duration = Math.max(Math.min(distance / 1.5, 1000), 350);
              Adapt.scrollTo(`${target + offsetValue }`, { offset: { top:  0 }, duration: duration });
            } else {
              //console.log('center of step!');
              var target = viewOnCenterStep;
              var distance = Math.abs(target - winScrollTop);
              var duration = Math.max(Math.min(distance / 1.5, 1000), 350);
              Adapt.scrollTo(`${target + offsetValue }`, { offset: { top:  0 }, duration: duration });
            }
          } else if (stepInsideImg && imgNotCentered && !imgInView) {
            var target = centerImg;
            var distance = Math.abs(target - winScrollTop);
            var duration = Math.max(Math.min(distance / 1.5, 1000), 350);
            Adapt.scrollTo(`${target + offsetValue }`, { offset: { top:  0 }, duration: duration });
            //console.log('middle of image!')
          }
        } else {
          if (!imgInView && !imageBiggerThanView) {
            var target = centerImg;
            var distance = Math.abs(target - winScrollTop);
            var duration = Math.min(distance, 1000);
            Adapt.scrollTo(`${target + offsetValue }`, { offset: { top:  0 }, duration: duration });
            //console.log('middle of image!')
          } else if (imageBiggerThanView) {
            if (instructionsExist) {
              var instructionsOffset = instructions.offset();
              var instructionsTop = instructionsOffset.top - navHeight;
              var target = instructionsTop;
              var distance = Math.abs(target - winScrollTop);
              var duration = Math.max(Math.min(distance / 1.5, 1000), 350);
              Adapt.scrollTo(`${target + offsetValue }`, { offset: { top:  0 }, duration: duration });
              //console.log('instructions!');
            } else {
              var button = self.$el.find('.top-button');
              var buttonOffset = button.offset();
              var buttonTop = buttonOffset.top - navHeight;
              var target = buttonTop;
              var distance = Math.abs(target - winScrollTop);
              var duration = Math.max(Math.min(distance / 1.5, 1000), 350);
              Adapt.scrollTo(`${target + offsetValue }`, { offset: { top:  0 }, duration: duration });
              //console.log('top of button!');
            }
          }
        }
      }, 50);
    },
  });

  return GuidedTourView;

});
