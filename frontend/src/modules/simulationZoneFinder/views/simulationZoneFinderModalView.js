// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {

  var Origin = require('core/origin');
  var Backbone = require('backbone');

  var SimulationZoneFinderModalView = Backbone.View.extend({

    className: 'simulation-zone-finder-modal',

    events: {
      "click .apply": "applyToForm",
      "click .cancel": "remove"
    },

    initialize: function () {
      var self = this;
      var componentId = this.getComponentId();
      const form = this.model.get('form');
      const simulationScreenImg = $('.scaffold-items-modal-sidebar #_graphic_src img.scaffold-asset-preview');
      const src = simulationScreenImg.attr('src');
      const imageId = src.substring(src.lastIndexOf('/') + 1);
      var forceFullWidth = $('.scaffold-items-modal-sidebar #_graphic input#_graphic__forceFullWidth');

      var data = {
        src: `api/asset/serve/${imageId}`,
        left: form.fields._position.$el.find('input#_position__left').val(),
        top: form.fields._position.$el.find('input#_position__top').val(),
        width: form.fields._position.$el.find('input#_position__width').val(),
        height: form.fields._position.$el.find('input#_position__height').val(),
        forceFullWidth: forceFullWidth.is(":checked")
      }
      this.model.set('actionData', data);
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
      this.listenTo(Origin, 'window:resize', this.resize);
    },

    render: function () {
      this.preRender();
      var template = Handlebars.templates['simulationZoneFinderModal'];
      this.$el.html(template(this.model.attributes));
      this.postRender();
      return this;
    },


    postRender: function () {
      var self = this;
      var image = this.$el.find('img');
      image.on('load', function () {
        self.onImageLoaded();
      });
    },

    remove: function () {
      this.cropper.destroy();
      Backbone.View.prototype.remove.apply(this, arguments);
    },

    resize: function(){
      this.initializeCropper();
    },

    onImageLoaded: function () {
      this.initializeCropper();
    },

    initializeCropper: function () {
      if(this.cropper){
        this.cropper.destroy();
      }
      var data = this.model.get('actionData', data);
      var image = this.$el.find('img')[0];
      this.cropper = new Cropper(image, {
        viewMode: 3,
        movable: false,
        scalable: false,
        zoomable: false,
        rotatable: false,
        autoCropArea: 1,
        responsive: true,

        crop: function(event) {
          var imageCtn = $('.zone-finder-image-wrapper .cropper-wrap-box');
          const imageContainer = imageCtn[0];
          const containerRect = imageContainer.getBoundingClientRect();

          var originalImageCtn = $('.zone-finder-image-wrapper img');
          const originalImageContainer = originalImageCtn[0];
          const originalWidth = originalImageContainer.naturalWidth;
          const originalHeight = originalImageContainer.naturalHeight;

          // Get the rendered dimensions of the image
          const renderedWidth = containerRect.width;
          const renderedHeight = containerRect.height;

          // Calculate the scaling factor
          const scaleX = originalWidth / renderedWidth;
          const scaleY = originalHeight / renderedHeight;

          // Get the crop data from the event detail
          // Adjust the crop data to use the rendered size
          const adjustedCropData = {
            x: event.detail.x / scaleX,
            y: event.detail.y / scaleY,
            width: event.detail.width / scaleX,
            height: event.detail.height / scaleY
          };

          var percentageX = (adjustedCropData.x / containerRect.width) * 100;
          var percentageY = (adjustedCropData.y / containerRect.height) * 100;
          var percentageWidth = (adjustedCropData.width / containerRect.width) * 100;
          var percentageHeight = (adjustedCropData.height / containerRect.height) * 100;

          var data = {
            top: percentageY.toFixed(2),
            left: percentageX.toFixed(2),
            width: percentageWidth.toFixed(2),
            height: percentageHeight.toFixed(2)
          };

          $('.zone-finder-controls .left').html(data.left);
          $('.zone-finder-controls .top').html(data.top);
          $('.zone-finder-controls .width').html(data.width);
          $('.zone-finder-controls .height').html(data.height);

          if(data.left !== 'NaN' && data.top !== 'NaN' && data.width !== 'NaN' && data.height !== 'NaN'){
            self.model.set('actionData', data);
          }
        },

        ready: function(){
          if(data.left === '0' && data.height === '0' && data.width === '0' && data.height === '0'){
            self.cropper.clear();
          } else if(data.left && data.height  && data.width && data.height) {
            var imageCtn = $('.zone-finder-image-wrapper .cropper-wrap-box');
            const imageContainer = imageCtn[0];
            const containerRect = imageContainer.getBoundingClientRect();

            var percentageX = parseFloat(data.left || '0');
            var percentageY = parseFloat(data.top || '0');
            var percentageWidth = parseFloat(data.width || '0');
            var percentageHeight = parseFloat(data.height || '0');

            var originalImageCtn = $('.zone-finder-image-wrapper img');
            const originalImageContainer = originalImageCtn[0];
            const originalWidth = originalImageContainer.naturalWidth;
            const originalHeight = originalImageContainer.naturalHeight;

            var clientX = percentageX / 100 * originalWidth;
            var clientY = percentageY / 100 * originalHeight;
            var clientWidth = percentageWidth / 100 * originalWidth;
            var clientHeight = percentageHeight / 100 * originalHeight;

            var initialCropBox = {
              x: clientX,
              y: clientY,
              width: clientWidth,
              height: clientHeight
            };

            self.cropper.setData(initialCropBox);
          }
        }
      });
      var self = this;
    },

    setFinderSize: function(){
      var data = this.model.get('actionData');
      var imageCtn = $('.zone-finder-image-wrapper .cropper-wrap-box');
      var img = imageCtn[0];
      var originalImageCtn = $('.zone-finder-image-wrapper img');
      const originalImageContainer = originalImageCtn[0];
      const originalWidth = originalImageContainer.naturalWidth;
      var currentWidth = img.clientWidth;
      var difference = originalWidth - currentWidth;
      var percentageChange = (difference / originalWidth) * 100;
      data.zoneFinderSize = percentageChange;
      this.model.set('pinData', data);
    },

    applyToForm: function () {
      this.setFinderSize();
      var data = this.model.get('actionData');
      this.applyToFields(data);
      this.remove();
    },

    applyToFields: function (data) {
      var form = this.model.get('form');
      var zoneFinderSize = form.fields._zonefinderSize.$el.find('input#_zonefinderSize');
      var left = form.fields._position.$el.find('input#_position__left');
      var top = form.fields._position.$el.find('input#_position__top');
      var width = form.fields._position.$el.find('input#_position__width');
      var height = form.fields._position.$el.find('input#_position__height');
      zoneFinderSize.val(data.zoneFinderSize);
      left.val(data.left);
      top.val(data.top);
      width.val(data.width);
      height.val(data.height);
    },

    getComponentId: function () {
      const hash = window.location.hash;
      const parts = hash.split('/');
      const extractedPart = parts[parts.length - 2];
      return extractedPart !== "" ? extractedPart : '000';
    }

  });

  return SimulationZoneFinderModalView;

});
