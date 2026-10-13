/**
 * login.js — Mobile-first High-Contrast Outdoor Login Page.
 *
 * Implements:
 *   - Doc 06 S01 (Login screen, 16px font on inputs, 44px touch targets).
 *   - Doc 03 F-01 (Authentication flow, remember me, error handling).
 *   - Forced password change interceptor.
 */

window.pages = window.pages || {};

window.pages.login = function(container) {
  var t = window.i18n.t;

  container.innerHTML = `
    <div style="max-width: 420px; margin: 1.5rem auto; padding: 0 1rem;">
      <div class="card" style="padding: 2rem 1.5rem; text-align: center; border-top: 4px solid var(--brand);">
        <div style="margin-bottom:1.25rem;">
          <img src="assets/logo-full-560.png" alt="Suryadoot Energy Solution" style="max-width:240px; width:80%; height:auto; margin:0 auto; display:block;" />
        </div>

        <h1 style="font-size:1.35rem; font-weight:700; margin:0 0 0.5rem; color:var(--text-main);">${ui.esc(t('login.title'))}</h1>
        <p style="font-size:0.875rem; color:var(--text-muted); margin:0 0 1.5rem;">${ui.esc(t('login.subtitle'))}</p>

        <form id="login-form" style="text-align:left;">
          <div style="margin-bottom: 1.25rem;">
            <label for="login-username" style="display:block; font-size:0.875rem; font-weight:600; margin-bottom:0.4rem; color:var(--text-main);">
              ${ui.esc(t('login.username_label'))}
            </label>
            <input
              type="text"
              id="login-username"
              name="username"
              class="form-control"
              placeholder="${ui.esc(t('login.username_placeholder'))}"
              required
              autocomplete="username"
              style="width:100%; min-height:48px; font-size:1rem; padding:0.75rem; border:1.5px solid var(--border); border-radius:8px; box-sizing:border-box;"
            />
          </div>

          <div style="margin-bottom: 1.25rem;">
            <label for="login-password" style="display:block; font-size:0.875rem; font-weight:600; margin-bottom:0.4rem; color:var(--text-main);">
              ${ui.esc(t('login.password_label'))}
            </label>
            <div style="position:relative;">
              <input
                type="password"
                id="login-password"
                name="password"
                class="form-control"
                placeholder="${ui.esc(t('login.password_placeholder'))}"
                required
                autocomplete="current-password"
                style="width:100%; min-height:48px; font-size:1rem; padding:0.75rem 2.75rem 0.75rem 0.75rem; border:1.5px solid var(--border); border-radius:8px; box-sizing:border-box;"
              />
              <button
                type="button"
                id="toggle-pwd-btn"
                style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; min-width:40px; min-height:40px; display:flex; align-items:center; justify-content:center;"
                aria-label="Toggle password visibility"
              >
                👁
              </button>
            </div>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem;">
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.875rem; color:var(--text-main); cursor:pointer; min-height:44px;">
              <input type="checkbox" id="login-remember" style="width:20px; height:20px; accent-color:var(--brand);" />
              <span>${ui.esc(t('login.remember_me'))}</span>
            </label>
          </div>

          <button
            type="submit"
            id="login-submit-btn"
            class="btn btn-primary btn-block"
            style="min-height:48px; font-size:1rem; font-weight:600; width:100%;"
          >
            ${ui.esc(t('login.submit_btn'))}
          </button>
        </form>
      </div>
    </div>
  `;

  // Password toggle
  var pwdInput = document.getElementById('login-password');
  var toggleBtn = document.getElementById('toggle-pwd-btn');
  if (toggleBtn && pwdInput) {
    toggleBtn.addEventListener('click', function() {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        toggleBtn.textContent = '🔒';
      } else {
        pwdInput.type = 'password';
        toggleBtn.textContent = '👁';
      }
    });
  }

  // Form submit handler
  var form = document.getElementById('login-form');
  var submitBtn = document.getElementById('login-submit-btn');

  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var username = document.getElementById('login-username').value.trim();
      var password = document.getElementById('login-password').value;
      var remember = document.getElementById('login-remember').checked;

      if (!username || !password) return;

      ui.withButtonLoading(submitBtn, async function() {
        try {
          var res = await api.call('auth.login', {
            username: username,
            password: password,
            remember: remember
          }, { skipAuth: true });

          auth.setSession(res.token, remember, res.user, res.permissions);

          if (res.user.must_change_password) {
            ui.showToast(t('login.must_change_pwd_notice') || 'Please update your password to proceed', 'warning', 4000);
            window.showPasswordChangeModal(true);
          } else {
            var userName = (res.user && res.user.name) ? res.user.name : (res.user && res.user.username) ? res.user.username : 'User';
            ui.showToast(t('login.welcome', { name: userName }), 'success', 2500);
            var targetHash = window.auth.can('dashboard.get') ? '#/dashboard' : '#/sites';
            window.location.hash = targetHash;
          }
        } catch (err) {
          var errMsg = err.message || t('err.INVALID_CREDENTIALS') || 'Login failed';
          ui.showToast(errMsg, 'error', 4500);
        }
      });
    });
  }
};
