// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Origin = require('core/origin');
  var Helpers = require('core/helpers');
  var mutationObserverMap = {};

  function startKeyboardTrap(keyboardTrapObject){
    if (keyboardTrapObject && keyboardTrapObject.$el) {
      var focusableItems = $(`.${keyboardTrapObject.$el.attr('class').replace(' ', '.')} :focusable:not(.trap-wrapper)`);
      if (focusableItems && focusableItems.length > 0) {
        focusableItems.first().on('keydown', function (e) {
          var keyCode = e.keyCode || e.which;
          if (e.type == 'keydown' && keyCode === 9 && e.shiftKey) {
            e.preventDefault();
            focusableItems.last().focus();
          }
        });
        focusableItems.last().on('keydown', function (e) {
          var keyCode = e.keyCode || e.which;
          if (e.type == 'keydown' && keyCode === 9 && !e.shiftKey) {
            e.preventDefault();
            focusableItems.first().focus();
          }
        });
      }
    }
  }

  function stopKeyboardtrap(keyboardTrapObject) {
    var focusableItems = $(`.${keyboardTrapObject.$el.attr('class')} :focusable`);
    if (focusableItems && focusableItems.length > 1) {
      focusableItems.first().off('keydown');
      focusableItems.last().off('keydown');
    }
  }

  Origin.on('startkeyboardtrap', function(keyboardTrapObject, opts) {
    if (opts && opts.userMutationObserver && keyboardTrapObject && keyboardTrapObject.$el) {
      var elClassName = keyboardTrapObject.$el.attr('class');
      if (!mutationObserverMap[elClassName]) {
        var node = document.getElementsByClassName(elClassName)[0];
        var config = { attributes: true, childList: true, subtree: true };
        var callback = (mutationList, observer) => {
          var focusableItems = $(`.${keyboardTrapObject.$el.attr('class').replace(' ', '.')} :focusable:not(.trap-wrapper)`);
          if (mutationObserverMap[elClassName] && !mutationObserverMap[elClassName]['startedKeyboardTrap']) {
            if (focusableItems.length > 1) {
              startKeyboardTrap(keyboardTrapObject);
              mutationObserverMap[elClassName]['startedKeyboardTrap'] = true;
            }
          }
        };
        var observer = new MutationObserver(callback);
        observer.observe(node, config);
        mutationObserverMap[elClassName] = observer;
      }
    }
    else {
      startKeyboardTrap(keyboardTrapObject);
    }
  });

  Origin.on('stopkeyboardtrap', function(keyboardTrapObject) {
    if (keyboardTrapObject && keyboardTrapObject.$el) {
      var elClassName = keyboardTrapObject.$el.attr('class');
      if (mutationObserverMap[elClassName]) {
        var observer = mutationObserverMap[elClassName];
        if (observer) observer.disconnect();
        delete mutationObserverMap[elClassName];
      }
    }
    stopKeyboardtrap(keyboardTrapObject)
  });
})
