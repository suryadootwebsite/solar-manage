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

    var tabLabels = {
      dashboard: t('nav.dashboard') || 'Dashboard',
      sites: t('nav.sites') || 'Sites',
      stock: t('nav.stock') || 'Stock',
      lots: t('nav.purchase') || 'Purchase',
      customers: t('nav.customers') || 'Customers',
      masters: t('nav.masters') || 'Masters',
      money: t('nav.money') || 'Money',
      reports: t('nav.reports') || 'Reports',
      users: t('nav.users') || 'Users',
      settings: t('nav.settings') || 'Settings'
    };

    for (var key in tabLabels) {
      var el = document.getElementById('tab-label-' + key);
      if (el) el.textContent = tabLabels[key];
    }

    // Update user initial in header
    var user = window.auth.getUser();
    var initialEl = document.getElementById('user-initial');
    if (initialEl) {
      var name = (user && user.name) ? user.name.trim() : (user && user.username) ? user.username.trim() : 'U';
      initialEl.textContent = name.charAt(0).toUpperCase();
    }
  }

  updateUIStrings();

  // Header brand click -> go to dashboard if authenticated (B2)
  var headerBrand = document.getElementById('header-brand');
  if (headerBrand) {
    headerBrand.addEventListener('click', function() {
      if (window.auth && window.auth.isAuthenticated()) {
        window.location.hash = window.auth.can('dashboard.get') ? '#/dashboard' : '#/sites';
      }
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
  // Edge fade gradients update for swipeable bottom bar (B2)
  // ---------------------------------------------------------------------------
  function updateNavEdgeFades() {
    var nav = document.getElementById('bottom-nav');
    var fadeLeft = document.getElementById('nav-fade-left');
    var fadeRight = document.getElementById('nav-fade-right');
    if (!nav || !fadeLeft || !fadeRight) return;

    var scrollLeft = nav.scrollLeft;
    var maxScroll = nav.scrollWidth - nav.clientWidth;

    if (scrollLeft > 6) {
      fadeLeft.classList.add('is-visible');
    } else {
      fadeLeft.classList.remove('is-visible');
    }

    if (maxScroll > 6 && scrollLeft < maxScroll - 6) {
      fadeRight.classList.add('is-visible');
    } else {
      fadeRight.classList.remove('is-visible');
    }
  }

  var navEl = document.getElementById('bottom-nav');
  if (navEl) {
    navEl.addEventListener('scroll', updateNavEdgeFades);
    window.addEventListener('resize', updateNavEdgeFades);
  }

  // ---------------------------------------------------------------------------
  // Center active tab into view (B2)
  // ---------------------------------------------------------------------------
  function centerActiveNavTab() {
    var nav = document.getElementById('bottom-nav');
    if (!nav) return;
    var activeTab = nav.querySelector('.nav-tab.active');
    if (activeTab) {
      // Calculate target scrollLeft to center activeTab within nav container
      var targetLeft = activeTab.offsetLeft - (nav.clientWidth / 2) + (activeTab.clientWidth / 2);
      nav.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
    setTimeout(updateNavEdgeFades, 350);
  }

  window.addEventListener('hashchange', function() {
    setTimeout(centerActiveNavTab, 50);
  });

  // ---------------------------------------------------------------------------
  // Navigation visibility & Role permissions (B1, B3)
  // OWNER: Dashboard, Sites, Stock, Purchase, Customers, Masters, Money, Reports, Users, Settings
  // MANAGER: only permitted actions (e.g. Dashboard, Sites, Stock, Purchase, Customers, Masters, Reports)
  // SITE_USER: only Sites, Stock (if permitted)
  // ---------------------------------------------------------------------------
  function syncNavVisibility() {
    var isAuth = window.auth.isAuthenticated();
    var header = document.getElementById('app-header');
    var navContainer = document.getElementById('bottom-nav-container');

    if (!isAuth) {
      document.body.classList.add('not-authenticated');
      if (header) header.style.display = 'none';
      if (navContainer) navContainer.style.display = 'none';
      return;
    }

    document.body.classList.remove('not-authenticated');
    if (header) header.style.display = 'flex';
    if (navContainer) navContainer.style.display = 'block';

    updateUIStrings();

    var role = window.auth.getRole() || 'SITE_USER';

    // Map each tab to its permission requirement
    var tabPermissions = {
      dashboard: window.auth.can('dashboard.get'),
      sites: window.auth.can('sites.list'),
      stock: window.auth.can('stock.summary'),
      lots: window.auth.can('lots.list'),
      customers: window.auth.can('customers.list'),
      masters: window.auth.can('products.list') || window.auth.can('locations.list'),
      money: role === 'OWNER' && window.auth.can('cpay.add'),
      reports: role !== 'SITE_USER' && window.auth.can('reports.list'),
      users: role === 'OWNER' && window.auth.can('users.list'),
      settings: role === 'OWNER'
    };

    for (var tabKey in tabPermissions) {
      var tabElement = document.querySelector('[data-tab="' + tabKey + '"]');
      if (tabElement) {
        tabElement.style.display = tabPermissions[tabKey] ? '' : 'none';
      }
    }

    setTimeout(function() {
      updateNavEdgeFades();
      centerActiveNavTab();
    }, 100);
  }

  // ---------------------------------------------------------------------------
  // User Menu in Header (B5)
  // Small round button with user initial that opens a bottom sheet with:
  // user name and role, language toggle, change password, logout.
  // ---------------------------------------------------------------------------
  function openUserMenuSheet() {
    var t = window.i18n.t;
    var user = window.auth.getUser() || {};
    var role = user.role || 'SITE_USER';
    var name = user.name || user.username || 'User';

    var roleBadges = {
      OWNER: '<span class="badge badge-success">OWNER</span>',
      DEVELOPER: '<span class="badge badge-info">DEVELOPER · View only</span>',
      MANAGER: '<span class="badge badge-info">MANAGER</span>',
      SITE_USER: '<span class="badge badge-warning">SITE USER</span>'
    };

    var menuHtml = `
      <div style="padding:0.5rem 0 1rem; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:0.75rem;">
        <div style="width:48px; height:48px; border-radius:50%; background:var(--brand); color:#fff; font-size:1.3rem; font-weight:700; display:flex; align-items:center; justify-content:center;">
          ${name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-weight:700; font-size:1.05rem; color:var(--text-main);">${window.ui.esc(name)}</div>
          <div style="margin-top:0.2rem;">${roleBadges[role] || role}</div>
          ${role === 'DEVELOPER' ? '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--text-muted,#888);">Read-only access — cannot modify data</div>' : ''}
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:1rem;">
        <!-- Switch Language -->
        <button type="button" id="um-lang-btn" class="btn btn-secondary" style="justify-content:flex-start; min-height:48px; font-size:0.95rem;">
          🌐 <strong>${window.i18n.getLang() === 'hi' ? 'Switch to English (EN)' : 'हिंदी में बदलें (HI)'}</strong>
        </button>

        <!-- Change Password -->
        <button type="button" id="um-change-pwd-btn" class="btn btn-secondary" style="justify-content:flex-start; min-height:48px; font-size:0.95rem;">
          🔒 ${window.ui.esc(t('settings.change_pwd') || 'Change Password')}
        </button>

        <!-- Logout -->
        <button type="button" id="um-logout-btn" class="btn btn-danger" style="justify-content:flex-start; min-height:48px; font-size:0.95rem; margin-top:0.5rem;">
          🚪 ${window.ui.esc(t('settings.logout') || 'Log Out')}
        </button>
      </div>
    `;

    window.ui.openBottomSheet(t('settings.title') || 'Account', menuHtml, '');

    var langBtn = document.getElementById('um-lang-btn');
    if (langBtn) {
      langBtn.onclick = async function() {
        var newLang = window.i18n.toggleLang();
        window.ui.closeBottomSheet();
        if (window.auth.isAuthenticated()) {
          try { await window.api.call('auth.setLang', { lang: newLang }); } catch(e){}
        }
      };
    }

    var changePwdBtn = document.getElementById('um-change-pwd-btn');
    if (changePwdBtn) {
      changePwdBtn.onclick = function() {
        window.ui.closeBottomSheet();
        window.showPasswordChangeModal(false);
      };
    }

    var logoutBtn = document.getElementById('um-logout-btn');
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

  var userMenuBtn = document.getElementById('user-menu-btn');
  if (userMenuBtn) {
    userMenuBtn.onclick = openUserMenuSheet;
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

  window.router.register('/leads', window.pages.leads);
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

  // 4. Auth guard: before router activates, verify session.
  // With a stored token, verify it (auth.me) before showing the shell;
  // on UNAUTHORIZED clear everything and show only the login screen.
  if (window.auth.isAuthenticated()) {
    try {
      var meData = await window.api.call('auth.me', {}, { skipAuth: false });
      if (meData && meData.user) {
        window.auth.updateUser(meData.user);
      }
    } catch (e) {
      if (e && (e.code === 'UNAUTHORIZED' || e.code === 'INVALID_TOKEN' || e.code === 'EXPIRED_TOKEN')) {
        window.auth.clearToken();
      }
    }
  }

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
