/**
 * Usertour Extended Library
 * 
 * Production-quality extension for the usertour core library.
 * Provides enhanced initialization, configuration management, and test mode UI.
 * 
 * @module UsertourExtended
 */

(function (global) {
  'use strict';

  // ============================================================================
  // Configuration Constants
  // ============================================================================

  const CONFIG = {
    // LocalStorage keys
    STORAGE_KEY: 'ut-configurator',
    
    // Library readiness polling
    POLL_INTERVAL_MS: 100,
    POLL_TIMEOUT_MS: 5000,
    
    // Test mode UI
    TEST_MODE_BANNER_CLASS: 'vertical-banner',
    TEST_MODE_STYLE_ATTR: 'data-testmode-style',
    TEST_MODE_BANNER_WIDTH: 15,
    
    // Environment variable keys
    ENV_VAR_KEYS: {
      TEST: 'ENVIRONMENT_TEST',
      LIVE: 'ENVIRONMENT_LIVE'
    }
  };

  // ============================================================================
  // Configuration Manager
  // ============================================================================

  /**
   * Manages configuration retrieval from localStorage.
   * Provides a clean interface for accessing stored configuration values.
   */
  class ConfigurationManager {
    /**
     * Retrieves a configuration value from localStorage.
     * 
     * @param {string} key - The configuration key to retrieve
     * @returns {*} The configuration value, or null if not found
     */
    static getConfigValue(key) {
      if (!key || typeof key !== 'string') {
        console.warn('[UsertourExtended] Invalid config key:', key);
        return null;
      }

      try {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (!stored) {
          return null;
        }

        const config = JSON.parse(stored);
        return config && config[key] ? config[key] : null;
      } catch (error) {
        console.warn('[UsertourExtended] Failed to parse config from localStorage:', error);
        return null;
      }
    }

    /**
     * Checks if test mode is enabled in configuration.
     * 
     * @returns {boolean} True if test mode is enabled
     */
    static isTestMode() {
      return this.getConfigValue('testMode') === true;
    }
  }

  // ============================================================================
  // Library Ready Checker
  // ============================================================================

  /**
   * Manages waiting for the usertour core library to be ready.
   * Uses polling with timeout to detect when the library is available.
   */
  class LibraryReadyChecker {
    /**
     * Waits for the usertour library to be ready.
     * 
     * @param {Function} callback - Function to call when library is ready
     * @param {number} [pollInterval=CONFIG.POLL_INTERVAL_MS] - Polling interval in ms
     * @param {number} [timeout=CONFIG.POLL_TIMEOUT_MS] - Maximum wait time in ms
     * @returns {void}
     */
    static waitForLibrary(callback, pollInterval = CONFIG.POLL_INTERVAL_MS, timeout = CONFIG.POLL_TIMEOUT_MS) {
      if (typeof callback !== 'function') {
        throw new Error('[UsertourExtended] Callback must be a function');
      }

      const startTime = Date.now();

      /**
       * Internal polling function
       */
      function poll() {
        // Check if usertour is available and has the required init method
        if (global.usertour && typeof global.usertour.init === 'function') {
          callback();
          return;
        }

        // Check timeout
        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          console.warn('[UsertourExtended] Usertour object not ready after timeout');
          return;
        }

        // Continue polling
        setTimeout(poll, pollInterval);
      }

      // Start polling
      poll();
    }
  }

  // ============================================================================
  // Test Mode UI Manager
  // ============================================================================

  /**
   * Manages the test mode visual indicator (vertical banner).
   * Handles creation, removal, and cleanup of test mode UI elements.
   */
  class TestModeUIManager {
    /**
     * Removes existing test mode UI elements.
     * 
     * @private
     */
    static _removeExistingElements() {
      const banner = document.querySelector(`.${CONFIG.TEST_MODE_BANNER_CLASS}`);
      if (banner) {
        banner.remove();
      }

      const style = document.querySelector(`style[${CONFIG.TEST_MODE_STYLE_ATTR}]`);
      if (style) {
        style.remove();
      }
    }

    /**
     * Creates and injects test mode banner styles.
     * 
     * @private
     * @returns {HTMLStyleElement} The created style element
     */
    static _createStyles() {
      const style = document.createElement('style');
      style.setAttribute(CONFIG.TEST_MODE_STYLE_ATTR, 'true');
      style.textContent = `
        body {
          padding-left: ${CONFIG.TEST_MODE_BANNER_WIDTH}px !important;
        }
        .${CONFIG.TEST_MODE_BANNER_CLASS} {
          width: ${CONFIG.TEST_MODE_BANNER_WIDTH}px;
          height: 100%;
          background-color: rgb(255, 0, 90);
          display: flex;
          align-items: center;
          justify-content: center;
          position: fixed;
          top: 0;
          left: 0;
          z-index: 9999;
        }
        .${CONFIG.TEST_MODE_BANNER_CLASS} .vertical-text {
          writing-mode: vertical-lr;
          text-orientation: mixed;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }
      `;
      return style;
    }

    /**
     * Creates and injects test mode banner element.
     * 
     * @private
     * @returns {HTMLDivElement} The created banner element
     */
    static _createBanner() {
      const banner = document.createElement('div');
      banner.className = CONFIG.TEST_MODE_BANNER_CLASS;
      banner.innerHTML = '<span class="vertical-text">Usertour Mode: Test</span>';
      return banner;
    }

    /**
     * Updates the test mode UI based on the current test mode state.
     * 
     * @param {boolean} isTestMode - Whether test mode is enabled
     */
    static updateUI(isTestMode) {
      // Always remove existing elements first to ensure clean state
      this._removeExistingElements();

      if (isTestMode) {
        // Only add UI if document is ready
        if (document.body) {
          const style = this._createStyles();
          const banner = this._createBanner();

          document.head.appendChild(style);
          document.body.appendChild(banner);
        } else {
          // Wait for DOM to be ready
          if (document.addEventListener) {
            document.addEventListener('DOMContentLoaded', () => {
              this.updateUI(isTestMode);
            });
          }
        }
      }
    }
  }

  // ============================================================================
  // Role Resolver
  // ============================================================================

  /**
   * Resolves user role from various sources.
   * Provides a centralized way to determine the user's role.
   */
  class RoleResolver {
    /**
     * Resolves the user role from the provided options or fallback sources.
     * 
     * @param {Object} [options] - Options object that may contain a role
     * @param {string} [options.role] - Explicit role from options
     * @returns {string|null} The resolved role, or null if not found
     */
    static resolve(options) {
      // Priority 1: Explicit role from options
      if (options && options.role) {
        return options.role;
      }

      // Priority 2: Role from usertour internal state
      if (global.usertour && 
          global.usertour._app && 
          global.usertour._app.userInfo && 
          global.usertour._app.userInfo.data && 
          global.usertour._app.userInfo.data.role) {
        return global.usertour._app.userInfo.data.role;
      }

      return null;
    }
  }

  // ============================================================================
  // Environment Selector
  // ============================================================================

  /**
   * Selects the appropriate environment configuration.
   * Determines whether to use test or live environment based on configuration.
   */
  class EnvironmentSelector {
    /**
     * Gets the environment token based on test mode configuration.
     * 
     * @returns {string|null} The environment token, or null if not available
     */
    static getEnvironmentToken() {
      const isTestMode = ConfigurationManager.isTestMode();
      const envVars = global.USERTOURJS_ENV_VARS;

      if (!envVars) {
        console.warn('[UsertourExtended] USERTOURJS_ENV_VARS not defined');
        return null;
      }

      const envKey = isTestMode 
        ? CONFIG.ENV_VAR_KEYS.TEST 
        : CONFIG.ENV_VAR_KEYS.LIVE;

      const token = envVars[envKey];

      if (!token) {
        console.warn(`[UsertourExtended] Environment token not found: ${envKey}`);
      }

      return token || null;
    }
  }

  // ============================================================================
  // Main Extension
  // ============================================================================

  /**
   * Main extension class that orchestrates all components.
   * Provides the public API for enabling usertour with extended features.
   */
  class UsertourExtended {
    /**
     * Initializes and enables usertour with extended features.
     * 
     * This method:
     * 1. Determines the appropriate environment (test/live)
     * 2. Initializes the usertour core library
     * 3. Identifies the anonymous user with role information
     * 4. Updates the test mode UI if applicable
     * 
     * @param {Object} [options] - Configuration options
     * @param {string} [options.role] - User role to identify with
     * @returns {void}
     * 
     * @example
     * usertour.enableUserTour({ role: 'admin' });
     */
    static enableUserTour(options = {}) {
      // Validate usertour is available
      if (!global.usertour) {
        console.error('[UsertourExtended] usertour core library not available');
        return;
      }

      if (typeof global.usertour.init !== 'function') {
        console.error('[UsertourExtended] usertour.init is not a function');
        return;
      }

      try {
        // Get environment token
        const environmentToken = EnvironmentSelector.getEnvironmentToken();
        if (!environmentToken) {
          console.warn('[UsertourExtended] No environment token available, initialization may fail');
        }

        // Initialize usertour with the selected environment
        global.usertour.init(environmentToken);

        // Resolve and set user role
        const role = RoleResolver.resolve(options);
        if (role) {
          global.usertour.identifyAnonymous({ role: role });
        } else {
          global.usertour.identifyAnonymous();
        }

        // Update test mode UI
        const isTestMode = ConfigurationManager.isTestMode();
        TestModeUIManager.updateUI(isTestMode);

      } catch (error) {
        console.error('[UsertourExtended] Error enabling usertour:', error);
      }
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initializes the extension once the usertour core library is ready.
   * Attaches the enableUserTour method to the global usertour object.
   */
  LibraryReadyChecker.waitForLibrary(function () {
    if (global.usertour) {
      // Attach the extension method to the usertour object
      global.usertour.enableUserTour = UsertourExtended.enableUserTour;
    } else {
      console.error('[UsertourExtended] Failed to attach extension: usertour not available');
    }
  });

})(typeof window !== 'undefined' ? window : this);

