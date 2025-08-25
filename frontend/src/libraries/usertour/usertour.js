(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, (global.usertour = global.usertour || {}, global.usertour.js = factory()));
})(this, (function () { 'use strict';

  /**
   * Returns `es2020` if the browser supports ES2020 features, `legacy` otherwise.
   *
   * It would be better to detect features, but there's no way to test e.g. if
   * dynamic imports are available in containing apps that may prevent `eval` via
   * their Content-Security-Policy.
   *
   * It's important that we don't mistake a legacy browser as es2020 (since that
   * may cause us to run an incompatible version), but it's okay to mistake an
   * es2020-capable browser and serve them the legacy version.
   *
   * The browser version numbers are based off of caniuse.com data of browsers
   * supporting ALL of the the following features:
   * - https://caniuse.com/es6-module-dynamic-import
   * - https://caniuse.com/mdn-javascript_operators_nullish_coalescing
   * - https://caniuse.com/mdn-javascript_operators_optional_chaining
   * - https://caniuse.com/bigint
   * - https://caniuse.com/mdn-javascript_builtins_promise_allsettled
   * - https://caniuse.com/mdn-javascript_builtins_globalthis
   * - https://caniuse.com/mdn-javascript_builtins_string_matchall
   */
  function detectBrowserTarget(agent) {
      var options = [
          // Edge. Can contain "Chrome", so must come before Chrome.
          [/Edg\//, /Edg\/(\d+)/, 80],
          // Opera. Can contain "Chrome", so must come before Chrome
          [/OPR\//, /OPR\/(\d+)/, 67],
          // Chrome. Can contain "Safari", so must come before Safari.
          [/Chrome\//, /Chrome\/(\d+)/, 80],
          // Chrome on iOS. Can contain "Safari", so must come before Safari.
          // I'm not sure exactly what the engine driving Chrome iOS is, but assuming
          // it's based on iOS Safari, which hit v14 (that's es2020 compatible) on
          // September 16, 2020, and CriOS apparently hit v100 in April 11, 2022, we
          // just go with 100.
          [/CriOS\//, /CriOS\/(\d+)/, 100],
          // Safari
          [/Safari\//, /Version\/(\d+)/, 14],
          // Firefox
          [/Firefox\//, /Firefox\/(\d+)/, 74]
      ];
      for (var i = 0; i < options.length; i++) {
          var option = options[i];
          var browserRegExp = option[0];
          var versionRegExp = option[1];
          var minVersion = option[2];
          if (!agent.match(browserRegExp)) {
              // No this browser
              continue;
          }
          // Must be this browser, so version has to be found and be greater than
          // minVersion, otherwise we'll fall back to `legacy`.
          var versionMatch = agent.match(new RegExp(versionRegExp));
          if (versionMatch) {
              var version = parseInt(versionMatch[1], 10);
              if (version >= minVersion) {
                  return 'es2020';
              }
          }
          break;
      }
      return 'legacy';
  }

  var w = typeof window === 'undefined' ? {} : window;
  var usertour = w.usertour;
  console.log('enter npm backage, usertour:', usertour);
  if (!usertour) {
      //
      var urlPrefix = 'https://js.usertour.io/';
      console.log('enter npm backage: ', urlPrefix);
      // Initialize as an empty object (methods will be stubbed below)
      var loadPromise = null;
      usertour = w.usertour = {
          _stubbed: true,
          // Helper to inject the proper Usertour.js script/module into the document
          load: function () {
              // Make sure we only load Usertour.js once
              if (!loadPromise) {
                  loadPromise = new Promise(function (resolve, reject) {
                      var script = document.createElement('script');
                      script.async = true;
                      // Detect if the browser supports es2020
                      var envVars = w.USERTOURJS_ENV_VARS || {};
                      var browserTarget = envVars.USERTOURJS_BROWSER_TARGET ||
                          detectBrowserTarget(navigator.userAgent);
                      if (browserTarget === 'es2020') {
                          script.type = 'module';
                          script.src =
                              envVars.USERTOURJS_ES2020_URL || urlPrefix + 'es2020/usertour.js';
                      }
                      else {
                          script.src =
                              envVars.USERTOURJS_LEGACY_URL ||
                                  urlPrefix + 'legacy/usertour.iife.js';
                      }
                      script.onload = function () {
                          resolve();
                      };
                      script.onerror = function () {
                          document.head.removeChild(script);
                          loadPromise = null;
                          var e = new Error('Could not load Usertour.js');
                          console.warn(e.message);
                          reject(e);
                      };
                      document.head.appendChild(script);
                  });
              }
              return loadPromise;
          }
      };
      // Initialize the queue, which will be flushed by Usertour.js when it loads
      var q = (w.USERTOURJS_QUEUE = w.USERTOURJS_QUEUE || []);
      /**
       * Helper to stub void-returning methods that should be queued
       */
      var stubVoid = function (
      // eslint-disable-next-line es5/no-rest-parameters
      method) {
          // @ts-ignore
          usertour[method] = function () {
              var args = Array.prototype.slice.call(arguments);
              usertour.load();
              q.push([method, null, args]);
          };
      };
      // Helper to stub promise-returning methods that should be queued
      var stubPromise = function (
      // eslint-disable-next-line es5/no-rest-parameters
      method) {
          // @ts-ignore
          usertour[method] = function () {
              var args = Array.prototype.slice.call(arguments);
              usertour.load();
              var deferred;
              var promise = new Promise(function (resolve, reject) {
                  deferred = { resolve: resolve, reject: reject };
              });
              q.push([method, deferred, args]);
              return promise;
          };
      };
      // Helper to stub methods that MUST return a value synchronously, and
      // therefore must support using a default callback until Usertour.js is
      // loaded.
      var stubDefault = function (method, returnValue) {
          // @ts-ignore
          usertour[method] = function () {
              return returnValue;
          };
      };
      // Methods that return void and should be queued
      stubVoid('init');
      stubVoid('off');
      stubVoid('on');
      stubVoid('reset');
      stubVoid('setBaseZIndex');
      stubVoid('setSessionTimeout');
      stubVoid('setTargetMissingSeconds');
      stubVoid('setCustomInputSelector');
      stubVoid('setCustomNavigate');
      stubVoid('setCustomScrollIntoView');
      stubVoid('setInferenceAttributeFilter');
      stubVoid('setInferenceAttributeNames');
      stubVoid('setInferenceClassNameFilter');
      stubVoid('setScrollPadding');
      stubVoid('setServerEndpoint');
      stubVoid('setShadowDomEnabled');
      stubVoid('setPageTrackingDisabled');
      stubVoid('setUrlFilter');
      stubVoid('setLinkUrlDecorator');
      // Methods that return promises and should be queued
      stubPromise('endAll');
      stubPromise('group');
      stubPromise('identify');
      stubPromise('identifyAnonymous');
      stubPromise('start');
      stubPromise('track');
      stubPromise('updateGroup');
      stubPromise('updateUser');
      // Methods that synchronously return and can be stubbed with default return
      // values and are not queued
      stubDefault('isIdentified', false);
      stubDefault('isStarted', false);
  }
  var usertour$1 = usertour;

  return usertour$1;

}));
//# sourceMappingURL=usertour.umd.js.map