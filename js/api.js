/**
 * api.js — API Client & Network Subsystem with Retry Logic.
 *
 * Implements:
 *   - JSON-RPC v1 request envelope (Doc 05 §2).
 *   - Auto UUID request_id for idempotency.
 *   - Doc 03 F-30 Retry Handling (2 retries on network error or LOCKED with 1s, 3s backoff).
 *   - If LOCKED persists after all retries, throws LOCKED error (not NETWORK_ERROR).
 *   - Unauthorized handling -> automatic redirect to login.
 */

window.api = (function() {

  function _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function _sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  var _activeRequests = 0;
  function _updateProgress() {
    var bar = document.getElementById('top-progress-bar');
    if (!bar) return;
    if (_activeRequests > 0) {
      bar.style.display = 'block';
      bar.style.width = '70%';
    } else {
      bar.style.width = '100%';
      setTimeout(function() {
        if (_activeRequests === 0) {
          bar.style.display = 'none';
          bar.style.width = '0%';
        }
      }, 200);
    }
  }

  /**
   * Calls an API action on the Google Apps Script backend.
   *
   * @param {string} action     e.g. 'system.ping', 'auth.login', 'lots.create'
   * @param {Object} [payload]  Action payload
   * @param {Object} [options]  { requestId: string, skipAuth: boolean }
   * @returns {Promise<Object>} Resolves with response.data on success
   */
  async function call(action, payload, options) {
    options = options || {};
    var requestId = options.requestId || _generateUUID();
    var token = options.skipAuth ? '' : window.auth.getToken();
    var lang = window.i18n.getLang();
    var apiUrl = window.APP_CONFIG.API_BASE_URL;

    var envelope = {
      v: window.APP_CONFIG.API_VERSION || 1,
      action: action,
      token: token,
      lang: lang,
      request_id: requestId,
      payload: payload || {}
    };

    var maxRetries = window.APP_CONFIG.MAX_RETRIES || 2;
    var backoffs = window.APP_CONFIG.RETRY_BACKOFF_MS || [1000, 3000];

    _activeRequests++;
    _updateProgress();
    try {
      for (var attempt = 0; attempt <= maxRetries; attempt++) {
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, window.APP_CONFIG.API_TIMEOUT_MS || 15000);

        var response;
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              // text/plain prevents CORS preflight in Apps Script
              'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(envelope),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (fetchErr) {
          clearTimeout(timeoutId);

          // Network error / timeout retry
          if (attempt < maxRetries) {
            await _sleep(backoffs[attempt]);
            continue;
          }

          // Network retries exhausted
          throw {
            code: 'NETWORK_ERROR',
            message: window.i18n.t('err.NETWORK_ERROR') || 'Network connection failed. Please check your internet.'
          };
        }

        // Process server HTTP response
        var data;
        try {
          data = await response.json();
        } catch (jsonErr) {
          throw { code: 'INVALID_JSON', message: 'Could not parse server response as JSON' };
        }

        if (data && data.ok) {
          if (window.location && window.location.search && window.location.search.indexOf('debug=1') !== -1) {
            var tm = data.meta && data.meta.timing;
            if (tm) {
              console.log('%c[API TIMING] ' + action, 'color:#2563eb;font-weight:bold;', {
                total_ms:    tm.total_ms,
                auth_ms:     tm.auth_ms,
                handler_ms:  tm.handler_ms,
                cache_hits:  tm.cache_hits,
                sheets_read: tm.sheets_read
              });
            } else if (data.meta && data.meta.ms) {
              console.log('[API TIMING] ' + action + ':', data.meta.ms + 'ms');
            }
          }
          return data.data;
        }

        var err = data ? data.error : { code: 'SERVER_ERROR', message: 'Unknown server error' };

        // Handle LOCKED status by retrying; if retries exhausted, throw LOCKED error
        if (err.code === 'LOCKED') {
          if (attempt < maxRetries) {
            await _sleep(backoffs[attempt]);
            continue;
          }
          throw err;
        }

        // Handle UNAUTHORIZED
        if (err.code === 'UNAUTHORIZED') {
          window.auth.clearToken();
          window.location.hash = '#/login';
          throw err;
        }

        // Any other business error: throw immediately without retry
        throw err;
      }
    } finally {
      _activeRequests--;
      _updateProgress();
    }
  }

  return {
    call: call
  };

})();
