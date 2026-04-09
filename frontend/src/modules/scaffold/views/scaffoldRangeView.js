define(['rangeslider', 'core/origin', 'backbone-forms'], function (rangeslider, Origin, BackboneForms) {
  var ScaffoldRangeView = Backbone.Form.editors.Base.extend({

    className: 'scaffold-range-editor',

    events: {
      'click .slider-scale-number': 'onNumberSelected',
      'focus input[type="range"]': 'onHandleFocus',
      'blur input[type="range"]': 'onHandleBlur'
    },

    initialize: function (options) {
      Backbone.Form.editors.Base.prototype.initialize.call(this, options);
      this.template = options.template || this.constructor.template;
      this.start = options.start || 0;
      this.min = options.min || 20;
      this.end = options.end || 100;
      this.max = options.max || 80;
      this.step = options.step || 5;
      this.scaleMinWidth = options.scaleMinWidth || 411;
      this.defaultValue = options.defaultValue || 50;
      this.handleDimension = 40;
      this.rangeDimension = 460;
      this._items = this.getRangeItems();
    },

    render: function() {
      this.$el.append(Handlebars.templates[this.constructor.template]({
        initValue: this.value || this.defaultValue,
        _items: this._items,
        start: this.start,
        end: this.end,
        min: this.min,
        max: this.max,
        scaleMinWidth: this.scaleMinWidth,
        rangeDimension: this.rangeDimension
      }));
      this.setValue(this.value);
      this.setupRangeslider();
      this.setScalePositions();
      this.onScreenSizeChanged();
      return this;
    },

    getDecimalPlaces: function (num) {
      return (num.toString().split('.')[1] || []).length;
    },

    getRangeItems: function () {
      var items = [];
      var start = this.start;
      var end = this.end;
      var step = this.step;

      var dp = this.getDecimalPlaces(step);

      for (var i = start; i <= end; i += step) {
        if (dp !== 0) {
          i = parseFloat(i.toFixed(dp));
        }

        items.push({
          value: i,
          selected: false,
        });
      }
      return items;
    },

    setValue: function (value) {
      this.$('input').val(value).trigger('change');
    },

    getValue: function () {
      var val = this.$('input').val();
      return val;
    },

    setupRangeslider: function () {
      this.$sliderScaleMarker = this.$('.slider-scale-marker');
      this.$slider = this.$('input[type="range"]');
      this.$slider.attr({ "step": this.step });

      this.$slider.rangeslider({
        polyfill: false,
        handleDimension: this.handleDimension,
        rangeDimension: this.rangeDimension,
        allowedMin: this.min,
        allowedMax: this.max,
        onSlide: _.bind(this.handleSlide, this)
      });
      this.oldValue = this.value;

      if (this._deferEnable) {
        this.setAllItemsEnabled();
      }
    },

    handleSlide: function (position, value) {
      if (this.oldValue === value) {
        return;
      }
      var itemIndex = this.getIndexFromValue(value);
      var pixels = this.mapIndexToPixels(itemIndex);
      this.selectItem(itemIndex, false);
      this.animateToPosition(pixels);
      this.oldValue = value;
    },

    setAllItemsEnabled: function () {
      var isEnabled = true;

      if (!this.$slider) {
        this._deferEnable = true; // slider is not yet ready
        return;
      }

      if (!isEnabled) {
        this.$('.slider-widget').addClass('disabled');
        this.$slider.prop('disabled', true).rangeslider('update', true);
        return;
      }

      this.$('.slider-widget').removeClass('disabled');
      this.$slider.prop('disabled', false).rangeslider('update', true);
    },

    // this should make the slider handle, slider marker and slider bar to animate to give position
    animateToPosition: function (newPosition) {
      if (!this.$sliderScaleMarker) return;

      this.$sliderScaleMarker
        .velocity('stop')
        .velocity({
          left: newPosition
        }, {
          duration: 200,
          easing: "linear",
          mobileHA: false
        });
    },

    // this shoud give the index of item using given slider value
    getIndexFromValue: function (itemValue) {
      var scaleStart = this.start;
      var scaleEnd = this.end;
      var val = Math.round(this.mapValue(itemValue, scaleStart, scaleEnd, 0, this._items.length - 1));
      return val;
    },

    // this should set given value to slider handle
    setAltText: function (value) {
      this.$('.slider-handle').attr('aria-valuenow', value);
    },

    mapIndexToPixels: function (value, $widthObject) {
      var numberOfItems = this._items.length;
      // var width = $widthObject ? $widthObject.width() : this.$('.slider-scaler').width();
      var width = this.scaleMinWidth;

      var val = Math.round(this.mapValue(value, 0, numberOfItems - 1, 0, width));
      return val;
    },

    mapPixelsToIndex: function (value) {
      var numberOfItems = this._items.length;
      var width = this.scaleMinWidth;

      return Math.round(this.mapValue(value, 0, width, 0, numberOfItems - 1));
    },

    normalise: function (value, low, high) {
      var range = high - low;
      return (value - low) / range;
    },

    mapValue: function (value, inputLow, inputHigh, outputLow, outputHigh) {
      var normal = this.normalise(value, inputLow, inputHigh);
      return normal * (outputHigh - outputLow) + outputLow;
    },

    onHandleFocus: function (event) {
      event.preventDefault();
      this.$slider.on('keydown', _.bind(this.onKeyDown, this));
      this.$el.find('.rangeslider__handle').addClass('hovered');
    },

    onHandleBlur: function (event) {
      event.preventDefault();
      this.$slider.off('keydown');
      this.$el.find('.rangeslider__handle').removeClass('hovered');
    },

    onKeyDown: function (event) {
      if (event.which === 9) return; // tab key
      event.preventDefault();
      var item = this._items.filter(item => item.selected === true)[0];
      var itemValue = item ? item.value : 20;
      var minIndex = this.getIndexFromValue(this.min)
      var maxIndex = this.getIndexFromValue(this.max);

      var newItemIndex = this.getIndexFromValue(itemValue);

      switch (event.which) {
        case 40: // ↓ down
        case 37: // ← left
          newItemIndex = Math.max(newItemIndex - 1, 0);
          break;
        case 38: // ↑ up
        case 39: // → right
          newItemIndex = Math.min(newItemIndex + 1, this._items.length - 1);
          break;
      }

      if (newItemIndex < minIndex) {
        newItemIndex = minIndex;
      }
      else if (newItemIndex > maxIndex) {
        newItemIndex = maxIndex;
      }

      this.selectItem(newItemIndex);
      if (typeof newItemIndex === 'number') this.showScaleMarker(true);
      this.animateToPosition(this.mapIndexToPixels(newItemIndex));
      this.setSliderValue(this.getValueFromIndex(newItemIndex));
      this.setAltText(this.getValueFromIndex(newItemIndex));
    },

    onNumberSelected: function (event) {
      event.preventDefault();

      // when component is not reset, selecting a number should be prevented
      if (this.$slider.prop('disabled')) {
        return;
      }

      var itemValue = parseFloat($(event.currentTarget).attr('data-id'));
      if (itemValue < this.min) {
        itemValue = this.min;
      }
      else if (itemValue > this.max) {
        itemValue = this.max;
      }
      var index = this.getIndexFromValue(itemValue);
      this.selectItem(index);
      this.animateToPosition(this.mapIndexToPixels(index));
      this.setAltText(itemValue);
      this.setSliderValue(itemValue);
    },

    getValueFromIndex: function (index) {
      return this._items[index].value;
    },

    resetControlStyles: function () {
      this.$('.slider-handle').empty();
      // this.showScaleMarker(false);
      this.$('.slider-bar').animate({ width: '0px' });
      this.setSliderValue(this._items[0].value);
    },

    // according to given item index this should make the item as selected
    selectItem: function (itemIndex, noFocus) {
      var allowedItem = false;
      var that = this;
      _.each(this._items, function (item, index) {
        item.selected = (index === itemIndex);
        allowedItem = item.value >= that.min || item.value <= that.max;
        if (item.selected && allowedItem) {
          this.$('input').attr({
            "value": item.value,
            "aria-valuenow": item.value
          });
        }
      }, this);
      this.showScaleMarker(true);
      // this.showNumber(true);
    },

    setScalePositions: function () {
      var numberOfItems = this._items.length;
      _.each(this._items, function (item, index) {
        var normalisedPosition = this.normalise(index, 0, numberOfItems - 1);
        this.$('.slider-scale-number').eq(index).data('normalisedPosition', normalisedPosition);
      }, this);
    },

    showScale: function () {
      var that = this;
      var $markers = this.$('.slider-markers').empty();

      var $scaler = this.$('.slider-scaler');
      for (var i = 1, count = this._items.length - 1; i < count; i++) {
        var sliderHTML = `<div class='slider-line component-item-color'
          style='left: ${this.mapIndexToPixels(i, $scaler)}px;'></div>`;

        if (that._items[i].value < that.min || that._items[i].value >= that.max) {
          sliderHTML += (`<div class='slider-line component-item-color'
            style="left: ${parseInt(that.mapIndexToPixels(i, $scaler)) + 2}px; width: ${parseInt(that.mapIndexToPixels(1, $scaler)) - 2 }px;background-color: #ccced1;"
          ></div>`);
        }

        sliderHTML = `<div>
          ${sliderHTML}
        </div>`;

        $markers.append(sliderHTML);
      }
      // Do we show scale numbers
      this.showScaleNumbers();
    },

    showScaleNumbers: function () {
      var $numbers = this.$('.slider-scale-number');

      var scaleWidth = this.scaleMinWidth;
      this._items.forEach(function (item, index) {
        var $number = $numbers.eq(index);
        var newLeft = Math.round($number.data('normalisedPosition') * scaleWidth);
        $number.css({ left: newLeft });
      });
    },

    //Labels are enabled in slider.hbs. Here we manage their containing div.
    showLabels: function () {

    },

    setSliderValue: function (value) {
      if (this.$slider) {
        this.$slider.val(value).change();
      }
    },

    remapSliderBar: function () {
      var $scaler = this.$('.slider-scaler');
      var selectedItem = this._items.filter(item => item.selected === true)[0] || this._items[0];
      var currentIndex = this.getIndexFromValue(selectedItem ? selectedItem.value : this.min);
      var left = this.mapIndexToPixels(currentIndex, $scaler);
      this.$('.slider-handle').css({ left: left + 'px' });
      this.$('.slider-scale-marker').css({ left: left + 'px' });
      this.$('.slider-bar').width(left);
    },

    onScreenSizeChanged: function () {
      this.showScale();
      this.showLabels();
      this.remapSliderBar();
      if (this.$('.slider-widget').hasClass('show-user-answer')) {
        this.hideCorrectAnswer();
      } else if (this.$('.slider-widget').hasClass('show-correct-answer')) {
        this.showCorrectAnswer();
      }
    },

    // this makes the marker visible or hidden
    showScaleMarker: function (show) {
      var $scaleMarker = this.$('.slider-scale-marker');
      this.showNumber(show);
      if (show) {
        $scaleMarker.addClass('display-block');
      } else {
        $scaleMarker.removeClass('display-block');
      }
    },

    // this should add the current slider value to the marker
    showNumber: function (show) {
      var $scaleMarker = this.$('.slider-scale-marker');
      var selectedItem = this._items.filter(item => item.selected === true)[0];
      if (show) {
        $scaleMarker.html(selectedItem ? selectedItem.value : this.min);
      } else {
        $scaleMarker.html = "";
      }
    }

  }, { template: 'scaffoldRange' });

  Origin.on('origin:dataReady', function () {
    Origin.scaffold.addCustomField('Range', ScaffoldRangeView);
  });

  return ScaffoldRangeView;

});
