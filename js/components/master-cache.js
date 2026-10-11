/**
 * master-cache.js — Client-side Master Data Cache.
 *
 * Keeps local cached copies of products, suppliers, customers, locations, stages.
 * Invalidated automatically on mutations.
 */

window.masterCache = (function() {
  var cache = {
    products: null,
    suppliers: null,
    customers: null,
    locations: null,
    stages: null
  };

  function get(key) {
    return cache[key];
  }

  function set(key, data) {
    cache[key] = data;
  }

  function invalidate(key) {
    if (key) {
      cache[key] = null;
    } else {
      for (var k in cache) cache[k] = null;
    }
  }

  async function load(key, actionName, payload) {
    if (cache[key]) return cache[key];
    try {
      var res = await window.api.call(actionName, payload || {});
      cache[key] = res.items || res;
      return cache[key];
    } catch(err) {
      console.warn('masterCache load failed for', key, err);
      return [];
    }
  }

  return {
    get: get,
    set: set,
    invalidate: invalidate,
    load: load
  };
})();
