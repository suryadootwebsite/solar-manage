/**
 * auth.js — Client-Side Authentication State, Token & Permissions Storage.
 *
 * Implements token & permission storage:
 *   - sessionStorage by default (12h session)
 *   - localStorage if remember-me was checked (7d session)
 *
 * Doc ref: Doc 06 §12 (Frontend Technical Notes), Doc 02 §7, Doc 05 §5
 */

window.auth = (function() {

  var TOKEN_KEY = 'solar_ms_auth_token';
  var USER_KEY = 'solar_ms_user';
  var PERMS_KEY = 'solar_ms_perms';

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  }

  function getUser() {
    var raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function getPermissions() {
    var raw = sessionStorage.getItem(PERMS_KEY) || localStorage.getItem(PERMS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function isOwnerLike(role) {
    return role === 'OWNER' || role === 'DEVELOPER';
  }

  function can(action) {
    var role = getRole();
    if (isOwnerLike(role)) return true;
    var perms = getPermissions();
    return perms.indexOf(action) !== -1;
  }

  function setSession(token, remember, user, permissions) {
    var storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
    if (user) storage.setItem(USER_KEY, JSON.stringify(user));
    if (permissions) storage.setItem(PERMS_KEY, JSON.stringify(permissions));
    window.dispatchEvent(new CustomEvent('authchange', { detail: { isAuthenticated: true, user: user } }));
  }

  function setToken(token, remember, user) {
    setSession(token, remember, user, null);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(PERMS_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PERMS_KEY);
    window.dispatchEvent(new CustomEvent('authchange', { detail: { isAuthenticated: false, user: null } }));
  }

  function isAuthenticated() {
    return Boolean(getToken());
  }

  function getRole() {
    var user = getUser();
    return user ? user.role : '';
  }

  function mustChangePassword() {
    var user = getUser();
    return Boolean(user && user.must_change_password);
  }

  function updateUser(patch) {
    var cur = getUser();
    if (!cur) return;
    for (var k in patch) {
      if (patch.hasOwnProperty(k)) cur[k] = patch[k];
    }
    if (localStorage.getItem(USER_KEY)) {
      localStorage.setItem(USER_KEY, JSON.stringify(cur));
    } else {
      sessionStorage.setItem(USER_KEY, JSON.stringify(cur));
    }
  }

  return {
    getToken: getToken,
    getUser: getUser,
    getPermissions: getPermissions,
    can: can,
    isOwnerLike: isOwnerLike,
    setSession: setSession,
    setToken: setToken,
    clearToken: clearToken,
    isAuthenticated: isAuthenticated,
    getRole: getRole,
    mustChangePassword: mustChangePassword,
    updateUser: updateUser
  };

})();
