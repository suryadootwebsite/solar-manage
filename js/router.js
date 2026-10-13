/**
 * router.js — Hash-Based Client-Side Router.
 *
 * Hash routing allows seamless GitHub Pages static hosting without server rewrites.
 *
 * Doc ref: Doc 06 §12 (Frontend Technical Notes)
 */

window.router = (function() {

  var _routes = {};
  var _currentRoute = '';

  function register(hash, handler) {
    _routes[hash] = handler;
  }

  function navigate(hash) {
    window.location.hash = hash;
  }

  function _handleRoute() {
    var rawHash = window.location.hash.slice(1) || '/';
    // Normalize path (strip query if any)
    var path = rawHash.split('?')[0];

    _currentRoute = path;

    // Strict Auth Guard inside router
    if (!window.auth || !window.auth.isAuthenticated()) {
      if (path !== '/login') {
        window.location.hash = '#/login';
        return;
      }
    }

    // Update bottom nav active state
    var navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(function(tab) {
      var href = tab.getAttribute('href');
      if (!href) return;
      var tabHash = href.slice(1);
      if (tabHash === path) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Match exact route or parameterized route (e.g. /sites/:id)
    var handler = null;
    var params = {};

    if (_routes[path]) {
      handler = _routes[path];
    } else {
      // Check parameterized routes
      var pathParts = path.split('/').filter(Boolean);
      for (var routePattern in _routes) {
        var patternParts = routePattern.split('/').filter(Boolean);
        if (patternParts.length === pathParts.length) {
          var match = true;
          var extractedParams = {};
          for (var i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
              var paramName = patternParts[i].slice(1);
              extractedParams[paramName] = decodeURIComponent(pathParts[i]);
            } else if (patternParts[i] !== pathParts[i]) {
              match = false;
              break;
            }
          }
          if (match) {
            handler = _routes[routePattern];
            params = extractedParams;
            break;
          }
        }
      }
    }

    var container = document.getElementById('main-content');

    if (handler && container) {
      container.innerHTML = '';
      handler(container, params);
    } else if (container) {
      // B1: Unknown route shows localized "Page not found" with dashboard link
      var t = window.i18n ? window.i18n.t : function(k) { return k; };
      var notFoundTitle = t('nav.page_not_found') || 'Page Not Found';
      var notFoundMsg = t('nav.page_not_found_msg') || 'The requested page does not exist.';
      var backToDash = t('nav.back_to_dashboard') || 'Back to Dashboard';
      var dashHash = (window.auth && window.auth.can('dashboard.get')) ? '#/dashboard' : '#/sites';

      container.innerHTML = `
        <div class="card" style="text-align:center; padding:3rem 1.5rem; margin-top:2rem;">
          <div style="font-size:3rem; margin-bottom:1rem;">🔍</div>
          <h2 style="font-size:1.4rem; margin-bottom:0.5rem; color:var(--text-main);">${window.ui ? window.ui.esc(notFoundTitle) : notFoundTitle}</h2>
          <p style="color:var(--text-muted); margin-bottom:1.5rem;">${window.ui ? window.ui.esc(notFoundMsg) : notFoundMsg}</p>
          <a href="${dashHash}" class="btn btn-primary" style="display:inline-flex; min-height:44px; align-items:center; justify-content:center; padding:0.5rem 1.5rem; text-decoration:none;">
            ${window.ui ? window.ui.esc(backToDash) : backToDash}
          </a>
        </div>
      `;
    }
  }

  function init() {
    window.addEventListener('hashchange', _handleRoute);
    window.addEventListener('localechange', _handleRoute);
    // Initial routing
    if (!window.location.hash) {
      if (window.auth && window.auth.isAuthenticated()) {
        window.location.hash = window.auth.can('dashboard.get') ? '#/dashboard' : '#/sites';
      } else {
        window.location.hash = '#/login';
      }
    } else {
      _handleRoute();
    }
  }

  return {
    register: register,
    navigate: navigate,
    init: init
  };

})();
