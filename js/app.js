/**
 * app.js — Main Application Bootstrap.
 *
 * Bootstraps ServiceWorker, i18n, network listeners, routes, and router.
 * Loaded externally to strictly satisfy CSP script-src 'self' without 'unsafe-inline'.
 */

(async function() {
  // 1. Initialize PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('./service-worker.js')
        .then(function(reg) {
          console.log('ServiceWorker registered with scope:', reg.scope);
        })
        .catch(function(err) {
          console.warn('ServiceWorker registration failed:', err);
        });
    });
  }

  // 2. Initialize i18n
  await window.i18n.init();

  function updateUIStrings() {
    var lang = window.i18n.getLang();
    var t = window.i18n.t;

    var langBtn = document.getElementById('lang-btn-text');
    if (langBtn) langBtn.textContent = lang === 'hi' ? 'EN' : 'HI';

    var headerTitle = document.getElementById('app-header-title');
    if (headerTitle) headerTitle.textContent = t('app.title');

    var pingTab = document.getElementById('tab-label-ping');
    if (pingTab) pingTab.textContent = t('nav.ping');

    var sitesTab = document.getElementById('tab-label-sites');
    if (sitesTab) sitesTab.textContent = t('nav.sites');

    var stockTab = document.getElementById('tab-label-stock');
    if (stockTab) stockTab.textContent = t('nav.stock');

    var dashTab = document.getElementById('tab-label-dashboard');
    if (dashTab) dashTab.textContent = t('nav.dashboard');

    var usersTab = document.getElementById('tab-label-users');
    if (usersTab) usersTab.textContent = t('users.title');

    var lotsTab = document.getElementById('tab-label-lots');
    if (lotsTab) lotsTab.textContent = t('nav.lots');

    var customersTab = document.getElementById('tab-label-customers');
    if (customersTab) customersTab.textContent = t('nav.customers');

    var mastersTab = document.getElementById('tab-label-masters');
    if (mastersTab) mastersTab.textContent = t('nav.masters');

    var settingsTab = document.getElementById('tab-label-settings');
    if (settingsTab) settingsTab.textContent = t('settings.title');
  }

  updateUIStrings();

  // Language toggle button listener
  var toggleBtn = document.getElementById('lang-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      window.i18n.toggleLang();
      updateUIStrings();
    });
  }

  window.addEventListener('localechange', updateUIStrings);

  // Online / Offline Detection
  function syncNetworkState() {
    if (navigator.onLine) {
      document.body.classList.remove('is-offline');
    } else {
      document.body.classList.add('is-offline');
    }
  }
  window.addEventListener('online', syncNetworkState);
  window.addEventListener('offline', syncNetworkState);
  syncNetworkState();

  // ---------------------------------------------------------------------------
  // Auth guard helper: hides/shows nav tabs based on role permissions.
  // Called once after route changes and after login/logout.
  // ---------------------------------------------------------------------------
  function syncNavVisibility() {
    var usersTab = document.querySelector('[data-tab="users"]');
    if (usersTab) {
      usersTab.style.display = window.auth.isAuthenticated() && window.auth.can('users.list') ? '' : 'none';
    }
    var lotsTab = document.querySelector('[data-tab="lots"]');
    if (lotsTab) {
      lotsTab.style.display = window.auth.isAuthenticated() && window.auth.can('lots.list') ? '' : 'none';
    }
    var customersTab = document.querySelector('[data-tab="customers"]');
    if (customersTab) {
      customersTab.style.display = window.auth.isAuthenticated() && window.auth.can('customers.list') ? '' : 'none';
    }
    var mastersTab = document.querySelector('[data-tab="masters"]');
    if (mastersTab) {
      mastersTab.style.display = window.auth.isAuthenticated() && (window.auth.can('products.list') || window.auth.can('locations.list')) ? '' : 'none';
    }
    var moneyTab = document.querySelector('[data-tab="money"]');
    if (moneyTab) {
      moneyTab.style.display = window.auth.isAuthenticated() && window.auth.can('cpay.add') ? '' : 'none';
    }
  }

  // ---------------------------------------------------------------------------
  // showPasswordChangeModal(forced)
  //   forced = true  → user MUST change password before using the app
  //   forced = false → voluntary change from Settings
  // Exported to window so any page can call it.
  // ---------------------------------------------------------------------------
  window.showPasswordChangeModal = function(forced) {
    var t = window.i18n.t;
    var title = forced ? t('change_pwd.forced_title') : t('change_pwd.title');
    var notice = forced
      ? '<p class="text-muted" style="font-size:0.85rem;margin-bottom:1rem;">' + window.ui.esc(t('change_pwd.forced_notice')) + '</p>'
      : '';

    var bodyHtml =
      notice +
      '<form id="change-pwd-form" novalidate>' +
        (forced ? '' :
          '<div class="form-field">' +
            '<label>' + window.ui.esc(t('change_pwd.old_label')) + '</label>' +
            '<input id="cpf-old" type="password" class="input" autocomplete="current-password">' +
          '</div>'
        ) +
        '<div class="form-field">' +
          '<label>' + window.ui.esc(t('change_pwd.new_label')) + '</label>' +
          '<input id="cpf-new" type="password" class="input" autocomplete="new-password">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + window.ui.esc(t('change_pwd.confirm_label')) + '</label>' +
          '<input id="cpf-confirm" type="password" class="input" autocomplete="new-password">' +
        '</div>' +
        '<div id="cpf-error" class="text-error" style="display:none;margin-bottom:0.75rem;font-size:0.85rem;"></div>' +
        '<button type="submit" class="btn btn-primary btn-full" id="cpf-submit">' +
          window.ui.esc(t('change_pwd.submit_btn')) +
        '</button>' +
      '</form>';

    window.ui.openBottomSheet(title, bodyHtml, '');

    document.getElementById('change-pwd-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var oldPwd    = forced ? '' : (document.getElementById('cpf-old').value || '');
      var newPwd    = document.getElementById('cpf-new').value || '';
      var confirmPwd = document.getElementById('cpf-confirm').value || '';
      var errEl     = document.getElementById('cpf-error');
      var submitBtn = document.getElementById('cpf-submit');

      if (newPwd !== confirmPwd) {
        errEl.textContent = t('change_pwd.mismatch');
        errEl.style.display = '';
        return;
      }
      errEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = '…';

      try {
        await window.api.call('auth.changePassword', { old_password: oldPwd, new_password: newPwd });
        window.auth.updateUser({ must_change_password: false });
        window.ui.closeBottomSheet();
        window.ui.toast(t('change_pwd.success'), 'success');
        if (forced) {
          // Redirect to main app after forced change
          window.location.hash = '#/ping';
        }
      } catch (err) {
        var code = (err && err.code) ? ('err.' + err.code) : 'err.NETWORK_ERROR';
        errEl.textContent = t(code) || (err && err.message) || 'Error';
        errEl.style.display = '';
        submitBtn.disabled = false;
        submitBtn.textContent = t('change_pwd.submit_btn');
      }
    });
  };

  // 3. Register Routes
  window.router.register('/login', window.pages.login);

  window.router.register('/', window.pages.ping);
  window.router.register('/ping', window.pages.ping);

  window.router.register('/sites', window.pages.sites);
  window.router.register('/sites/:id', window.pages.siteDetail);
  window.router.register('/material-issue', window.pages.materialIssue);
  window.router.register('/serials', window.pages.serialRegister);
  window.router.register('/money', window.pages.money);

  window.router.register('/stock', window.pages.stock);
  window.router.register('/transfers', window.pages.transfers);
  window.router.register('/import-stock', window.pages.importStock);

  window.router.register('/dashboard', window.pages.dashboard);
  window.router.register('/reports', window.pages.reports);

  window.router.register('/users', window.pages.users);
  window.router.register('/customers', window.pages.customers);
  window.router.register('/masters', window.pages.masters);
  window.router.register('/lots', window.pages.lots);
  window.router.register('/settings', window.pages.settings);

  // 4. Auth guard: before router activates, check session.
  //    If not authenticated and not on /login, redirect to /login.
  var currentHash = window.location.hash.replace('#', '') || '/';
  if (!window.auth.isAuthenticated() && currentHash !== '/login') {
    window.location.hash = '#/login';
  }

  // Sync nav visibility and listen for auth changes
  syncNavVisibility();
  window.addEventListener('authchange', syncNavVisibility);

  // 5. Start Router
  window.router.init();
})();
