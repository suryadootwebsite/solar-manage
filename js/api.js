/**
 * api.js — API Client & Network Subsystem with Retry Logic.
 *
 * Implements:
 *   - JSON-RPC v1 request envelope (Doc 05 §2).
 *   - Auto UUID request_id for idempotency.
 *   - Doc 03 F-30 Retry Handling (2 retries on network error or LOCKED with 1s, 3s backoff).
 *   - If LOCKED persists after all retries, throws LOCKED error (not NETWORK_ERROR).
 *   - Unauthorized handling -> automatic redirect to login.
 *   - In-flight deduplication & short-term read cache.
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

  // C1: In-flight deduplication — same action+payload shares one promise
  var _inFlight = {};
  // C1: Short read-only cache (20s) for idempotent GET-like actions
  var _readCache = {};
  var _cacheEpoch = 0;
  var READ_ACTIONS = ['sites.list','sites.get','lots.list','lots.get','dashboard.get',
    'users.list','products.list','suppliers.list','customers.list','locations.list',
    'masters.list','reports.get','stock.summary','stages.list','serials.list',
    'usage.list','app.bootstrap','sites.getFull'];
  var READ_CACHE_TTL = 20000; // 20 seconds

  function _cacheKey(action, payload) {
    return action + ':' + JSON.stringify(payload || {});
  }

  function _isReadAction(action) {
    return READ_ACTIONS.indexOf(action) !== -1;
  }

  function _clearEntityStorage(action) {
    var prefix = (action || '').split('.')[0].toLowerCase();
    var related = [prefix];

    if (prefix === 'stages' || prefix === 'usage' || prefix === 'serials') {
      related.push('sites', 'stock', 'dashboard');
    } else if (prefix === 'sites') {
      related.push('dashboard');
    } else if (prefix === 'lots' || prefix === 'transfers' || prefix === 'stock' || prefix === 'openingimport') {
      related.push('stock', 'lots', 'dashboard');
    } else if (prefix === 'cpay' || prefix === 'spay' || prefix === 'exp' || prefix === 'subsidy') {
      related.push('money', 'dashboard', 'sites');
    } else if (prefix === 'customers') {
      related.push('customers', 'dashboard');
    } else if (prefix === 'suppliers') {
      related.push('suppliers');
    } else if (prefix === 'products') {
      related.push('products', 'stock');
    } else if (prefix === 'users' || prefix === 'auth') {
      related.push('users');
    }

    if (related.indexOf('dashboard') === -1) {
      related.push('dashboard');
    }

    try {
      if (typeof sessionStorage !== 'undefined') {
        var toRemove = [];
        for (var i = 0; i < sessionStorage.length; i++) {
          var k = sessionStorage.key(i);
          if (!k) continue;
          if (k.indexOf('sms_auth_') === 0 || k === 'auth_token' || k === 'auth_user' || k === 'auth_perms') {
            continue;
          }
          var lower = k.toLowerCase();
          for (var r = 0; r < related.length; r++) {
            if (lower.indexOf(related[r]) !== -1) {
              toRemove.push(k);
              break;
            }
          }
        }
        for (var j = 0; j < toRemove.length; j++) {
          sessionStorage.removeItem(toRemove[j]);
        }
      }
    } catch (e) {}

    try {
      if (typeof window !== 'undefined' && window.masterCache && typeof window.masterCache.invalidate === 'function') {
        for (var m = 0; m < related.length; m++) {
          window.masterCache.invalidate(related[m]);
        }
      }
    } catch (e) {}
  }

  function invalidate(action) {
    _cacheEpoch++;
    if (!action) {
      _readCache = {};
      for (var ifk in _inFlight) {
        if (_isReadAction(ifk.split(':')[0])) {
          delete _inFlight[ifk];
        }
      }
      return;
    }
    var prefix = action + ':';
    for (var k in _readCache) {
      if (Object.prototype.hasOwnProperty.call(_readCache, k) && k.indexOf(prefix) === 0) {
        delete _readCache[k];
      }
    }
    for (var k2 in _inFlight) {
      if (k2.indexOf(prefix) === 0) {
        delete _inFlight[k2];
      }
    }
    _clearEntityStorage(action);
  }

  /**
   * Calls an API action on the Google Apps Script backend.
   *
   * @param {string} action     e.g. 'system.ping', 'auth.login', 'lots.create'
   * @param {Object} [payload]  Action payload
   * @param {Object} [options]  { requestId: string, skipAuth: boolean }
   * @returns {Promise<Object>} Resolves with response.data on success
   */
  function call(action, payload, options) {
    var key = _cacheKey(action, payload);
    if (_isReadAction(action)) {
      // Check short-term cache
      var cached = _readCache[key];
      if (cached && (Date.now() - cached.ts) < READ_CACHE_TTL) {
        return Promise.resolve(cached.data);
      }
      // Single-flight dedup
      if (_inFlight[key]) return _inFlight[key];
    }

    var p = _fetchWithRetry(action, payload, options);
    if (_isReadAction(action)) {
      var readEpoch = _cacheEpoch;
      _inFlight[key] = p;
      p.then(function(data) {
        if (_cacheEpoch === readEpoch) {
          _readCache[key] = { data: data, ts: Date.now() };
        }
        delete _inFlight[key];
        return data;
      }, function(err) {
        delete _inFlight[key];
        throw err;
      });
      return p;
    }

    // After ANY successful non-read call, clear read cache, in-flight reads, and related entity storage
    return p.then(function(data) {
      _cacheEpoch++;
      _readCache = {};
      for (var ifk in _inFlight) {
        if (_isReadAction(ifk.split(':')[0])) {
          delete _inFlight[ifk];
        }
      }
      _clearEntityStorage(action);
      return data;
    });
  }

  async function _fetchWithRetry(action, payload, options) {
    options = options || {};
    var requestId = options.requestId || _generateUUID();
    var token = options.skipAuth ? '' : (window.auth && window.auth.getToken ? window.auth.getToken() : '');
    var lang = (window.i18n && window.i18n.getLang ? window.i18n.getLang() : 'hi');
    var apiUrl = window.APP_CONFIG.API_BASE_URL;

    var envelope = {
      v: window.APP_CONFIG.API_VERSION || 1,
      action: action,
      token: token,
      lang: lang,
      request_id: requestId,
      payload: payload || {}
    };

    var maxRetries = window.APP_CONFIG.MAX_RETRIES !== undefined ? window.APP_CONFIG.MAX_RETRIES : 2;
    var backoffs = window.APP_CONFIG.RETRY_BACKOFF_MS || [1000, 3000];
    var timeoutMs = window.APP_CONFIG.API_TIMEOUT_MS || 45000;

    _activeRequests++;
    _updateProgress();

    // 20s Still Loading Popup with Wait & Retry (cancels in-flight, re-sends with SAME request_id)
    var slowPopupEl = null;
    var popupShown = false;
    var activeController = null;

    function _dismissSlowPopup() {
      if (slowPopupEl && slowPopupEl.parentNode) {
        slowPopupEl.parentNode.removeChild(slowPopupEl);
        slowPopupEl = null;
      }
    }

    function _showSlowPopup() {
      if (popupShown || slowPopupEl || typeof document === "undefined") return;
      popupShown = true;
      slowPopupEl = document.createElement("div");
      slowPopupEl.id = "still-loading-popup-" + requestId;
      slowPopupEl.className = "still-loading-popup";
      slowPopupEl.setAttribute("role", "alert");
      slowPopupEl.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
        "background:var(--bg-card, #ffffff);color:var(--text-main, #111827);" +
        "border:1px solid var(--border-color, #e5e7eb);box-shadow:0 10px 25px -5px rgba(0,0,0,0.25);" +
        "border-radius:12px;padding:0.85rem 1.15rem;z-index:10001;max-width:90vw;width:340px;" +
        "display:flex;flex-direction:column;gap:0.6rem;pointer-events:auto;";

      slowPopupEl.innerHTML = 
        "<div style=\"display:flex;align-items:center;gap:0.5rem;\">" +
          "<span style=\"font-size:1.25rem;\">⏳</span>" +
          "<span style=\"font-weight:600;font-size:0.85rem;line-height:1.3;\">Still loading... slow network. Please wait.</span>" +
        "</div>" +
        "<div style=\"display:flex;justify-content:flex-end;gap:0.5rem;\">" +
          "<button type=\"button\" class=\"btn btn-outline btn-sm btn-still-wait\" style=\"min-height:34px;padding:0.2rem 0.75rem;font-size:0.8rem;\">Wait</button>" +
          "<button type=\"button\" class=\"btn btn-primary btn-sm btn-still-retry\" style=\"min-height:34px;padding:0.2rem 0.75rem;font-size:0.8rem;\">Retry</button>" +
        "</div>";

      document.body.appendChild(slowPopupEl);

      var btnWait = slowPopupEl.querySelector(".btn-still-wait");
      var btnRetry = slowPopupEl.querySelector(".btn-still-retry");
      if (btnWait) {
        btnWait.addEventListener("click", function() {
          _dismissSlowPopup();
        });
      }
      if (btnRetry) {
        btnRetry.addEventListener("click", function() {
          _dismissSlowPopup();
          if (activeController) {
            try { activeController.abort(); } catch(e) {}
          }
        });
      }
    }

    var slowTimer = setTimeout(function() {
      _showSlowPopup();
    }, 20000);

    try {
      for (var attempt = 0; attempt <= maxRetries; attempt++) {
        var controller = new AbortController();
        activeController = controller;
        var timeoutId = setTimeout(function() { controller.abort(); }, timeoutMs);

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
            message: (window.i18n && window.i18n.t && window.i18n.t('err.NETWORK_ERROR')) || 'Network connection failed. Please check your internet.'
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
          if (window.auth && window.auth.clearToken) window.auth.clearToken();
          window.location.hash = '#/login';
          throw err;
        }

        // Any other business error: throw immediately without retry
        throw err;
      }
    } finally {
      clearTimeout(slowTimer);
      _activeRequests--;
      _updateProgress();
    }
  }

  return {
    call: call,
    invalidate: invalidate
  };

})();
