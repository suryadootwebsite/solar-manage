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

    // Update bottom nav active state
    var navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(function(tab) {
      var tabHash = tab.getAttribute('href').slice(1);
      if (tabHash === path || (path === '/' && tabHash === '/ping')) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    var handler = _routes[path] || _routes['/'] || _routes['/ping'];
    var container = document.getElementById('main-content');

    if (handler && container) {
      container.innerHTML = '';
      handler(container);
    }
  }

  function init() {
    window.addEventListener('hashchange', _handleRoute);
    window.addEventListener('localechange', _handleRoute);
    // Initial routing
    if (!window.location.hash) {
      window.location.hash = '#/ping';
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
