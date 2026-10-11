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

    var lotsTab = document.getElementById('tab-label-lots');
    if (lotsTab) lotsTab.textContent = t('nav.lots') || 'Purchase';

    var moreTab = document.getElementById('tab-label-more');
    if (moreTab) moreTab.textContent = t('nav.more') || 'More';
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
  // Auth guard & Navigation visibility (Doc 06 & Requirements B6, B8)
  // Max 5 items per role in bottom nav, plus 'More' bottom sheet.
  // OWNER: Dashboard, Sites, Stock, Purchase (lots), More
  // MANAGER: Dashboard, Sites, Stock, Purchase, More
  // SITE_USER: Sites, Stock (or specific allowed tabs), More
  // ---------------------------------------------------------------------------
  function syncNavVisibility() {
    var isAuth = window.auth.isAuthenticated();
    var header = document.getElementById('app-header');
    var nav = document.getElementById('bottom-nav');

    if (!isAuth) {
      document.body.classList.add('not-authenticated');
      if (header) header.style.display = 'none';
      if (nav) nav.style.display = 'none';
      return;
    }

    document.body.classList.remove('not-authenticated');
    if (header) header.style.display = 'flex';
    if (nav) nav.style.display = 'flex';

    var role = window.auth.getRole() || 'SITE_USER';

    // Configure visible bottom tabs based on role permissions
    var dashTab = document.querySelector('[data-tab="dashboard"]');
    if (dashTab) dashTab.style.display = window.auth.can('dashboard.get') ? '' : 'none';

    var sitesTab = document.querySelector('[data-tab="sites"]');
    if (sitesTab) sitesTab.style.display = window.auth.can('sites.list') ? '' : 'none';

    var stockTab = document.querySelector('[data-tab="stock"]');
    if (stockTab) stockTab.style.display = window.auth.can('stock.summary') ? '' : 'none';

    var lotsTab = document.querySelector('[data-tab="lots"]');
    if (lotsTab) lotsTab.style.display = window.auth.can('lots.list') ? '' : 'none';
  }

  // ---------------------------------------------------------------------------
  // 'More' bottom sheet for mobile (Requirement B8)
  // Contains items beyond the 4 primary tabs: Customers, Masters, Money, Reports, Users, Settings, language toggle, logout
  // ---------------------------------------------------------------------------
  function openMoreSheet() {
    var t = window.i18n.t;
    var user = window.auth.getUser() || {};
    var role = user.role || 'SITE_USER';

    var items = [];

    if (window.auth.can('customers.list')) {
      items.push({ hash: '#/customers', icon: '👥', label: t('nav.customers') || 'Customers' });
    }
    if (window.auth.can('products.list') || window.auth.can('locations.list')) {
      items.push({ hash: '#/masters', icon: '📦', label: t('nav.masters') || 'Masters' });
    }
    if (window.auth.can('cpay.add')) {
      items.push({ hash: '#/money', icon: '💰', label: t('money.title') || 'Money / P&L' });
    }
    if (window.auth.can('reports.list')) {
      items.push({ hash: '#/reports', icon: '📊', label: t('rep.title') || 'Reports' });
    }
    if (window.auth.can('users.list')) {
      items.push({ hash: '#/users', icon: '👤', label: t('users.title') || 'Users' });
    }
    items.push({ hash: '#/settings', icon: '⚙️', label: t('settings.title') || 'Settings' });

    var itemsHtml = `
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.75rem; padding:0.5rem 0;">
        ${items.map(function(item) {
          return `
            <a href="${item.hash}" class="more-nav-item card" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0.85rem 0.5rem; text-align:center; text-decoration:none; color:var(--text-main); border:1px solid var(--border-light); border-radius:8px; min-height:76px;">
              <span style="font-size:1.6rem; margin-bottom:0.25rem;">${item.icon}</span>
              <span style="font-size:0.75rem; font-weight:600; line-height:1.2;">${window.ui.esc(item.label)}</span>
            </a>
          `;
        }).join('')}
      </div>

      <div style="margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <button id="more-lang-btn" class="btn btn-secondary" style="min-height:40px; font-size:0.85rem;">
          🌐 ${window.i18n.getLang() === 'hi' ? 'English (EN)' : 'हिंदी (HI)'}
        </button>
        <button id="more-logout-btn" class="btn btn-danger" style="min-height:40px; font-size:0.85rem;">
          🚪 ${window.ui.esc(t('settings.logout') || 'Log Out')}
        </button>
      </div>
    `;

    window.ui.openBottomSheet(t('nav.more') || 'Menu', itemsHtml, '');

    // Bind item click to close sheet
    var modalBackdrop = document.getElementById('modal-backdrop');
    if (modalBackdrop) {
      modalBackdrop.querySelectorAll('.more-nav-item').forEach(function(el) {
        el.onclick = function() { window.ui.closeBottomSheet(); };
      });
    }

    var langBtn = document.getElementById('more-lang-btn');
    if (langBtn) {
      langBtn.onclick = async function() {
        var newLang = window.i18n.toggleLang();
        window.ui.closeBottomSheet();
        if (window.auth.isAuthenticated()) {
          try { await window.api.call('auth.setLang', { lang: newLang }); } catch(e){}
        }
      };
    }

    var logoutBtn = document.getElementById('more-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = function() {
        window.ui.closeBottomSheet();
        window.ui.confirmDialog(
          t('settings.logout_confirm_title') || 'Confirm Logout',
          t('settings.logout_confirm_msg') || 'Are you sure you want to log out?',
          async function() {
            try { await window.api.call('auth.logout'); } catch(e){}
            window.auth.clearToken();
            window.location.hash = '#/login';
          }
        );
      };
    }
  }

  // Bind 'More' button
  var moreBtn = document.getElementById('nav-more-btn');
  if (moreBtn) {
    moreBtn.onclick = openMoreSheet;
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
            // Redirect to primary app view after forced change
            var defaultHash = window.auth.can('dashboard.get') ? '#/dashboard' : '#/sites';
            window.location.hash = defaultHash;
          }
        } catch (err) {
          var fieldMsg = '';
          if (err && err.fields) {
            var fieldKeys = Object.keys(err.fields);
            if (fieldKeys.length > 0) {
              var fName = fieldKeys[0];
              var fCode = err.fields[fName];
              fieldMsg = t('err.' + fCode) || fCode;
            }
          }
          var code = (err && err.code) ? ('err.' + err.code) : 'err.GENERIC';
          errEl.textContent = fieldMsg || t(code) || (err && err.message) || t('err.GENERIC');
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
