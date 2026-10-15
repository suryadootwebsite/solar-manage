/**
 * i18n.js — Internationalization Subsystem (Hindi + English).
 *
 * Doc ref: Doc 06 §7 (Language Hindi + English)
 */

window.i18n = (function() {
  var _currentLang = localStorage.getItem('solar_ms_lang') || window.APP_CONFIG.DEFAULT_LANG || 'hi';
  var _dictionaries = {
    en: {},
    hi: {}
  };
  var _isLoaded = false;

  /**
   * Initializes translations by fetching JSON dictionaries independently.
   */
  async function init() {
    try {
      var enRes = await fetch('./locales/en.json');
      if (enRes.ok) _dictionaries.en = await enRes.json();
    } catch (e) {
      console.error('Failed to load en.json locale:', e);
    }

    try {
      var hiRes = await fetch('./locales/hi.json');
      if (hiRes.ok) _dictionaries.hi = await hiRes.json();
    } catch (e) {
      console.error('Failed to load hi.json locale:', e);
    }
    _isLoaded = true;
  }

  function getLang() {
    return _currentLang;
  }

  function setLang(lang) {
    if (lang !== 'hi' && lang !== 'en') return;
    _currentLang = lang;
    localStorage.setItem('solar_ms_lang', lang);
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('localechange', { detail: { lang: lang } }));
  }

  function toggleLang() {
    setLang(_currentLang === 'hi' ? 'en' : 'hi');
  }

  /**
   * Translates a key with optional placeholder interpolation.
   * e.g. t('err.INSUFFICIENT_STOCK', { product: 'Panel', need: 20, have: 15 })
   *
   * @param {string} key
   * @param {Object} [params]
   * @returns {string}
   */
  function t(key, params) {
    var dict = _dictionaries[_currentLang] || {};
    var fallback = _dictionaries.en || {};

    var text = dict[key] || fallback[key];
    if (!text) {
      var currentLang = _currentLang;
      if (typeof window !== 'undefined' && window.location && window.location.search.indexOf('debug=1') !== -1) {
        console.warn('[i18n] Missing key:', key, 'lang:', currentLang);
      }
      // A raw key like 'login.title' or 'nav.dashboard' must never reach the screen
      if (typeof key === 'string' && key.indexOf('.') !== -1) {
        text = _currentLang === 'hi' ? 'जानकारी उपलब्ध नहीं है' : 'Information unavailable';
      } else {
        text = key || '';
      }
    }

    if (params && typeof params === 'object') {
      for (var p in params) {
        if (params.hasOwnProperty(p)) {
          var regex = new RegExp('\\{' + p + '\\}', 'g');
          text = text.replace(regex, params[p]);
        }
      }
    }

    return text;
  }

  return {
    init: init,
    getLang: getLang,
    setLang: setLang,
    toggleLang: toggleLang,
    t: t
  };
})();
