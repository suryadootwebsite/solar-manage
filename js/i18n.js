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
   * Initializes translations by fetching JSON dictionaries.
   */
  async function init() {
    try {
      var [enRes, hiRes] = await Promise.all([
        fetch('./locales/en.json'),
        fetch('./locales/hi.json')
      ]);

      if (enRes.ok) _dictionaries.en = await enRes.json();
      if (hiRes.ok) _dictionaries.hi = await hiRes.json();
      _isLoaded = true;
    } catch (err) {
      console.error('Failed to load locale dictionaries:', err);
    }
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

    var text = dict[key] || fallback[key] || key;

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
