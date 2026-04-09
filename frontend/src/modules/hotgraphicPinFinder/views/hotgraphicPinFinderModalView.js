// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {

  var Origin = require('core/origin');
  var Backbone = require('backbone');

  var HotgraphicPinFinderModalView = Backbone.View.extend({

    className: 'hotgraphic-pin-finder-modal',

    events: {
      "click .apply": "applyToForm",
      "click .cancel": "remove"
    },

    initialize: function () {
      var self = this;
      var componentId = this.getComponentId();
      const form = this.model.get('form');
      const mainHotgraphicImg = $('.component-edit-inner').find("[data-key='properties']").find("img.scaffold-asset-preview");
      const src = mainHotgraphicImg.attr('src');
      const imageId = src.substring(src.lastIndexOf('/') + 1);
      const pinSrc = form.$el.find('#_pin_src img').attr('src');
      const pinImageId = pinSrc ? pinSrc.substring(src.lastIndexOf('/') + 1) : null;

      var forceFullWidth = $('.component-edit-inner').find("[data-key='properties']").find("input[name='_forceFullWidth']");

      var data = {
        src: `api/asset/serve/${imageId}`,
        pinSrc: pinImageId ? `api/asset/serve/${pinImageId}` : '',
        title: form.fields.title.$el.find('input#title').val() || 'Sample Title',
        forceFullWidth: forceFullWidth.is(":checked"),
        body: form.fields.body.$el.find('.ck-content').html(),
        left: form.fields._left.$el.find('input#_left').val(),
        top: form.fields._top.$el.find('input#_top').val(),
      }
      this.model.set('pinData', data);
      this.dragTargetBound = this.dragTarget.bind(this);
      this.stopDraggingBound = this.stopDragging.bind(this);
      if (componentId) {
        $.ajax({
          url: `api/content/component/${componentId}`,
          method: 'GET',
          async: false,
          success: function (res) {
            self.model.set('layoutFull', (res._layout === "full"));
            self.render();
          },
          error: function (error) {
            console.error('Problem loading component content info for component');
            self.remove();
          }
        });
      } else {
        console.error('Problem loading component content info for component');
        self.remove();
      }
    },

    preRender: function () {
      this.listenTo(Origin, 'window:resize', this.repositionTarget);
    },

    render: function () {
      this.preRender();
      var template = Handlebars.templates['hotgraphicPinFinderModal'];
      this.$el.html(template(this.model.attributes));
      this.postRender();
      return this;
    },

    postRender: function () {
      var self = this;
      var data = this.model.get('pinData');
      var image = this.$el.find('img');

      if (data && data.pinSrc && data.pinSrc.length > 0) {
        $('.module-editor').append(`<div id="hotgraphic-bullseye" class="hotgraphic-graphic-pin-image display-none">
          <img src="${data.pinSrc}">
        </div>`);
      }
      else {
        $('.module-editor').append('<div id="hotgraphic-bullseye" class="display-none icon icon-pin"></div>');
      }

      $('.module-editor #hotgraphic-bullseye').on('mousedown', function (event) {
        self.startDragging(event);
      });

      $('.module-editor #hotgraphic-bullseye').on('dragstart', function () {
        return false
      });

      image.on('load', function () {
        const pinImageCtn = $('.pin-finder-image-container');
        var positionNotZero = data.left !== '0' && data.top !== '0';
        if (pinImageCtn && image && (pinImageCtn.height() < image.height()) && positionNotZero) {
          data.left = '0';
          data.top = '0';
          self.model.set('pinData', data);
          Origin.Notify.alert({
            type: 'warning',
            text: Origin.l10n.t('app.pinfinder.imgtoohighwarning')
          });
        }
        self.onImageLoaded();
      });
    },

    remove: function () {
      $('#target').remove();
      $('#hotgraphic-bullseye').remove();
      Backbone.View.prototype.remove.apply(this, arguments);
    },

    onImageLoaded: function () {
      this.repositionTarget();
    },

    repositionTarget: function (opts) {
      var data = this.model.get('pinData');
      const bullseye = document.getElementById('hotgraphic-bullseye');
      var imageCtn = $('.pin-finder-image-wrapper img');
      const imageContainer = imageCtn[0];
      if (!imageContainer) return;
      const containerRect = imageContainer.getBoundingClientRect();

      var percentageX = parseFloat((opts && opts.left) || data.left || '0');
      var percentageY = parseFloat((opts && opts.top) || data.top || '0');
      var x = percentageX / 100 * containerRect.width;
      var y = percentageY / 100 * containerRect.height;

      const clientX = x + imageCtn.offset().left;
      const clientY = y + imageCtn.offset().top;

      $('.pin-finder-controls .left').html(percentageX.toFixed(2));
      $('.pin-finder-controls .top').html(percentageY.toFixed(2));

      bullseye.style.left = `${clientX}px`;
      bullseye.style.top = `${clientY}px`;

      $('.shepherd-element').removeClass('display-none');
      $('#target').removeClass('display-none');
      $('#hotgraphic-bullseye').removeClass('display-none');

      $('.pin-finder-controls .left').html(percentageX.toFixed(2));
      $('.pin-finder-controls .top').html(percentageY.toFixed(2));
    },

    startDragging: function (event) {
      window.isDragging = true;
      document.addEventListener('mousemove', this.dragTargetBound);
      document.addEventListener('mouseup', this.stopDraggingBound);
    },

    dragTarget: function (event) {
      if (window.isDragging) {
        var data = this.model.get('pinData');
        const bullseye = document.getElementById('hotgraphic-bullseye');
        var imageCtn = $('.pin-finder-image-wrapper img');
        const imageContainer = imageCtn[0];
        const containerRect = imageContainer.getBoundingClientRect();

        bullseye.style.left = `${event.clientX}px`;
        bullseye.style.top = `${event.clientY}px`;

        var targetLeft = event.clientX;
        var targetTop = event.clientY;

        const x = targetLeft - imageCtn.offset().left;
        const y = targetTop - imageCtn.offset().top;

        var percentageX = (x / containerRect.width) * 100;
        var percentageY = (y / containerRect.height) * 100;

        data.left = percentageX.toFixed(2);
        data.top = percentageY.toFixed(2);

        $('.pin-finder-controls .left').html(percentageX.toFixed(2));
        $('.pin-finder-controls .top').html(percentageY.toFixed(2));

        this.model.set('pinData', data);
      }
    },

    stopDragging: function () {
      this.handleOutOfViewport();
      window.isDragging = false;
      document.removeEventListener('mousemove', this.dragTargetBound);
      document.removeEventListener('mouseup', this.stopDraggingBound);
    },

    handleOutOfViewport: function () {
      const bullseyeRect = $('#hotgraphic-bullseye')[0].getBoundingClientRect();
      const pinfinderOverlay = $('.pin-finder-overlay');
      const pinfinderOverlayRect = pinfinderOverlay.length > 0 ? pinfinderOverlay[0].getBoundingClientRect() : null;
      const acceptableTop = pinfinderOverlayRect ? pinfinderOverlayRect.top : window.innerHeight * 2.5 / 100;
      const acceptableLeft = pinfinderOverlayRect ? pinfinderOverlayRect.left : window.innerWidth * 2.5 / 100;
      const acceptableBottom = pinfinderOverlayRect ? pinfinderOverlayRect.bottom : window.innerHeight;
      const acceptableRight = pinfinderOverlayRect ? pinfinderOverlayRect.right : window.innerWidth;

      if (
        bullseyeRect.bottom > acceptableBottom ||
        bullseyeRect.right > acceptableRight ||
        bullseyeRect.left < acceptableLeft ||
        bullseyeRect.top < acceptableTop
      ) {
        this.repositionTarget({ left: '0', top: '0' });
      }
    },

    setFinderSize: function(){
      var data = this.model.get('pinData');
      var imageCtn = $('.pin-finder-image-wrapper img');
      var img = imageCtn[0];
      var originalWidth = img.naturalWidth;
      var currentWidth = img.clientWidth;
      var difference = originalWidth - currentWidth;
      var percentageChange = (difference / originalWidth) * 100;
      data.pinFinderSize = percentageChange;
      this.model.set('pinData', data);
    },

    applyToForm: function () {
      this.setFinderSize();
      var data = this.model.get('pinData');
      this.applyToFields(data);
      this.remove();
    },

    applyToFields: function (data) {
      var form = this.model.get('form');
      var pinFinderSize = form.fields._pinfinderSize.$el.find('input#_pinfinderSize');
      var left = form.fields._left.$el.find('input#_left');
      var top = form.fields._top.$el.find('input#_top');
      pinFinderSize.val(data.pinFinderSize);
      left.val(data.left);
      top.val(data.top);
    },

    getComponentId: function () {
      const hash = window.location.hash;
      const parts = hash.split('/');
      const extractedPart = parts[parts.length - 2];
      return extractedPart !== "" ? extractedPart : '000';
    }

  });

  return HotgraphicPinFinderModalView;

});
