/**
 * users.js — Staff & User Administration View (Doc 03 F-02, Doc 05 §6).
 *
 * Implements:
 *   - User list with role badges and branch tags.
 *   - Create user with automatic temporary password modal display.
 *   - Reset password modal with one-click copy.
 *   - User activation / deactivation toggle with last-owner safety.
 */

window.pages = window.pages || {};

window.pages.users = function(container) {
  var t = window.i18n.t;

  if (window.auth.getRole() !== 'OWNER' && !window.auth.can('users.list')) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:2rem;">
        <h2>${ui.esc(t('err.FORBIDDEN') || 'Access Denied')}</h2>
        <p style="color:var(--text-muted);">${ui.esc(t('users.owner_only') || 'User administration is restricted to OWNER role.')}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto; padding: 1rem 0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
        <div>
          <h1 style="font-size:1.5rem; margin:0 0 0.25rem; color:var(--text-main);">${ui.esc(t('users.title') || 'User Management')}</h1>
          <p style="font-size:0.875rem; color:var(--text-muted); margin:0;">${ui.esc(t('users.subtitle') || 'Staff roles, branches, and credentials')}</p>
        </div>
        <button id="add-user-btn" class="btn btn-primary" style="min-height:44px; display:inline-flex; align-items:center; gap:0.5rem;">
          <span>+</span>
          <span>${ui.esc(t('users.new_btn') || 'Add User')}</span>
        </button>
      </div>

      <div style="margin-bottom:1rem;">
        <input
          type="text"
          id="users-search-input"
          class="form-control"
          placeholder="${ui.esc(t('users.search_placeholder') || 'Search users by name, username, or phone...')}"
          style="width:100%; min-height:44px; padding:0.5rem 0.75rem; border:1.5px solid var(--border); border-radius:8px; box-sizing:border-box;"
        />
      </div>

      <div id="users-list-container">
        <div style="text-align:center; padding:2rem;">
          <span class="spinner"></span>
        </div>
      </div>
    </div>
  `;

  var usersData = [];

  async function loadUsers() {
    var listContainer = document.getElementById('users-list-container');
    try {
      var res = await api.call('users.list');
      usersData = res.items || [];
      renderUsers(usersData);
    } catch (err) {
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="card" style="text-align:center; padding:1.5rem; color:var(--danger);">
            <p>${ui.esc(err.message || 'Failed to load users')}</p>
            <button id="retry-users-btn" class="btn btn-secondary" style="min-height:44px;">${ui.esc(t('btn.retry') || 'Retry')}</button>
          </div>
        `;
        var retryBtn = document.getElementById('retry-users-btn');
        if (retryBtn) retryBtn.onclick = loadUsers;
      }
    }
  }

  function renderUsers(items) {
    var listContainer = document.getElementById('users-list-container');
    if (!listContainer) return;

    if (items.length === 0) {
      listContainer.innerHTML = `
        <div class="card" style="text-align:center; padding:2rem; color:var(--text-muted);">
          <p>${ui.esc(t('users.empty') || 'No users found.')}</p>
        </div>
      `;
      return;
    }

    var html = items.map(function(u) {
      var isActive = u.is_active !== false;
      var roleColor = u.role === 'OWNER' ? 'var(--brand)' : 'var(--info, #3b82f6)';
      var statusBadge = isActive
        ? `<span class="badge" style="background:var(--success-light); color:var(--success);">Active</span>`
        : `<span class="badge" style="background:#fee2e2; color:#ef4444;">Disabled</span>`;

      return `
        <div class="card" style="margin-bottom:0.75rem; padding:1rem; border-left:4px solid ${roleColor};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <span style="font-weight:700; font-size:1.1rem; color:var(--text-main);">${ui.esc(u.name)}</span>
                <span class="badge" style="background:var(--bg-main); border:1px solid var(--border); font-size:0.75rem; font-weight:600;">${ui.esc(u.role)}</span>
                ${statusBadge}
              </div>
              <div style="font-size:0.875rem; color:var(--text-muted); margin-top:0.25rem;">
                <span>@${ui.esc(u.username)}</span>
                ${u.phone ? ` &bull; <span>${ui.esc(u.phone)}</span>` : ''}
                ${u.branch_ids ? ` &bull; <span>Branches: ${ui.esc(u.branch_ids)}</span>` : ''}
              </div>
            </div>
          </div>

          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem; border-top:1px solid var(--border); padding-top:0.75rem;">
            <button
              class="btn btn-secondary reset-pwd-btn"
              data-id="${ui.esc(u.user_id)}"
              data-name="${ui.esc(u.name)}"
              style="min-height:44px; font-size:0.875rem; padding:0.4rem 0.75rem;"
            >
              🔑 ${ui.esc(t('users.reset_pwd_btn') || 'Reset Password')}
            </button>
            <button
              class="btn ${isActive ? 'btn-danger' : 'btn-secondary'} toggle-active-btn"
              data-id="${ui.esc(u.user_id)}"
              data-name="${ui.esc(u.name)}"
              data-status="${isActive}"
              style="min-height:44px; font-size:0.875rem; padding:0.4rem 0.75rem;"
            >
              ${isActive ? (ui.esc(t('users.disable_btn') || 'Disable')) : (ui.esc(t('users.enable_btn') || 'Enable'))}
            </button>
          </div>
        </div>
      `;
    }).join('');

    listContainer.innerHTML = html;
    attachUserActions();
  }

  function attachUserActions() {
    // Reset Password buttons
    var resetBtns = document.querySelectorAll('.reset-pwd-btn');
    resetBtns.forEach(function(btn) {
      btn.onclick = function() {
        var userId = btn.getAttribute('data-id');
        var userName = btn.getAttribute('data-name');
        ui.confirmDialog(
          t('users.reset_pwd_confirm_title') || 'Reset Password',
          `Are you sure you want to reset password for "${userName}"? An auto-generated temporary password will be provided.`,
          async function() {
            try {
              ui.showSpinner();
              var res = await api.call('users.resetPassword', { user_id: userId });
              ui.hideSpinner();
              showTempPasswordModal(userName, res.temp_password);
            } catch (err) {
              ui.hideSpinner();
              ui.showToast(err.message || 'Password reset failed', 'error');
            }
          }
        );
      };
    });

    // Toggle Active/Disable buttons
    var toggleBtns = document.querySelectorAll('.toggle-active-btn');
    toggleBtns.forEach(function(btn) {
      btn.onclick = function() {
        var userId = btn.getAttribute('data-id');
        var userName = btn.getAttribute('data-name');
        var currentStatus = btn.getAttribute('data-status') === 'true';
        var actionVerb = currentStatus ? 'disable' : 'enable';

        ui.confirmDialog(
          currentStatus ? (t('users.disable_confirm_title') || 'Disable User') : 'Enable User',
          `Are you sure you want to ${actionVerb} access for "${userName}"?`,
          async function() {
            try {
              ui.showSpinner();
              await api.call('users.setActive', {
                user_id: userId,
                is_active: !currentStatus
              });
              ui.hideSpinner();
              ui.showToast(`User "${userName}" has been ${actionVerb}d`, 'success');
              loadUsers();
            } catch (err) {
              ui.hideSpinner();
              ui.showToast(err.message || 'Status update failed', 'error');
            }
          }
        );
      };
    });
  }

  function showTempPasswordModal(name, tempPassword) {
    ui.openBottomSheet(
      t('users.temp_pwd_title') || 'Temporary Password Generated',
      `
        <div style="text-align:center; padding:1rem 0;">
          <p style="font-size:0.95rem; color:var(--text-main); margin-bottom:1rem;">
            Temporary password for <strong>${ui.esc(name)}</strong>:
          </p>
          <div style="background:var(--brand-light); border:1.5px dashed var(--brand); border-radius:8px; padding:0.75rem 1rem; margin-bottom:1rem; display:inline-block;">
            <code id="temp-pwd-text" style="font-size:1.4rem; font-weight:700; color:var(--brand); letter-spacing:1px;">${ui.esc(tempPassword)}</code>
          </div>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:0;">
            Share this password with the staff member. They will be required to change it upon first login.
          </p>
        </div>
      `,
      `
        <button id="copy-pwd-btn" class="btn btn-primary btn-block" style="min-height:48px;">
          📋 ${ui.esc(t('btn.copy') || 'Copy Password')}
        </button>
        <button id="close-temp-pwd-btn" class="btn btn-secondary btn-block" style="min-height:48px;">
          ${ui.esc(t('btn.close') || 'Done')}
        </button>
      `
    );

    var copyBtn = document.getElementById('copy-pwd-btn');
    if (copyBtn) {
      copyBtn.onclick = function() {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(tempPassword);
          ui.showToast(t('btn.copied') || 'Password copied to clipboard!', 'success');
        }
      };
    }

    var closeBtn = document.getElementById('close-temp-pwd-btn');
    if (closeBtn) closeBtn.onclick = ui.closeBottomSheet;
  }

  // Add User Button
  var addBtn = document.getElementById('add-user-btn');
  if (addBtn) {
    addBtn.onclick = async function() {
      // Fetch default password from settings (fallback: 1234567890)
      var defaultPwd = '1234567890';
      try {
        var sRes = await api.call('settings.get', { key: 'default_new_user_password' });
        if (sRes && sRes.value) defaultPwd = sRes.value;
      } catch (e) {}

      // Fetch branches for selection
      var branches = [];
      try {
        var bRes = await api.call('branches.list', {});
        branches = bRes.items || [];
      } catch (e) {}

      var branchOptions = branches.length ? branches.map(function(b) {
        return `<label style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.875rem; margin-right:0.75rem;">
          <input type="checkbox" name="nu-branches" value="${ui.esc(b.branch_id)}" ${b.branch_id === 'BR-001' ? 'checked' : ''} />
          ${ui.esc(b.name || b.branch_id)}
        </label>`;
      }).join('') : `<input type="text" id="nu-branch" value="BR-001" class="form-control" style="width:100%; min-height:44px; padding:0.5rem; border:1.5px solid var(--border); border-radius:8px; box-sizing:border-box;" />`;

      ui.openBottomSheet(
        t('users.modal_create_title') || 'Create New User',
        `
          <form id="new-user-form" style="display:flex; flex-direction:column; gap:0.75rem;">
            <div>
              <label style="display:block; font-size:0.875rem; font-weight:600; margin-bottom:0.25rem;">Full Name *</label>
              <input type="text" id="nu-name" required class="form-control" style="width:100%; min-height:44px; padding:0.5rem; border:1.5px solid var(--border); border-radius:8px; box-sizing:border-box;" />
            </div>
            <div>
              <label style="display:block; font-size:0.875rem; font-weight:600; margin-bottom:0.25rem;">Username (Login ID) *</label>
              <input type="text" id="nu-username" required class="form-control" style="width:100%; min-height:44px; padding:0.5rem; border:1.5px solid var(--border); border-radius:8px; box-sizing:border-box;" />
            </div>
            <div>
              <label style="display:block; font-size:0.875rem; font-weight:600; margin-bottom:0.25rem;">Phone Number (10 Digits)</label>
              <input type="tel" id="nu-phone" class="form-control" style="width:100%; min-height:44px; padding:0.5rem; border:1.5px solid var(--border); border-radius:8px; box-sizing:border-box;" />
            </div>
            <div>
              <label style="display:block; font-size:0.875rem; font-weight:600; margin-bottom:0.25rem;">Role *</label>
              <select id="nu-role" required class="form-control" style="width:100%; min-height:44px; padding:0.5rem; border:1.5px solid var(--border); border-radius:8px; box-sizing:border-box; background:var(--bg-card); color:var(--text-main);">
                <option value="SITE_USER">${ui.esc(t('role.SITE_USER') || 'Site User')}</option>
                <option value="MANAGER">${ui.esc(t('role.MANAGER') || 'Manager')}</option>
                <option value="OWNER">${ui.esc(t('role.OWNER') || 'Owner')}</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-size:0.875rem; font-weight:600; margin-bottom:0.25rem;">Branch(es)</label>
              <div id="nu-branches-container" style="padding:0.5rem 0;">
                ${branchOptions}
              </div>
            </div>
            <div>
              <label style="display:block; font-size:0.875rem; font-weight:600; margin-bottom:0.25rem;">Optional Password</label>
              <div style="position:relative; display:flex; align-items:center;">
                <input type="password" id="nu-password" value="${ui.esc(defaultPwd)}" class="form-control" style="width:100%; min-height:44px; padding:0.5rem 2.5rem 0.5rem 0.5rem; border:1.5px solid var(--border); border-radius:8px; box-sizing:border-box;" />
                <button type="button" id="nu-toggle-pwd" style="position:absolute; right:8px; background:none; border:none; cursor:pointer; font-size:1.1rem; padding:4px;" title="Show/Hide">👁️</button>
              </div>
            </div>
            <div>
              <label style="display:block; font-size:0.875rem; font-weight:600; margin-bottom:0.25rem;">Language</label>
              <select id="nu-lang" class="form-control" style="width:100%; min-height:44px; padding:0.5rem; border:1.5px solid var(--border); border-radius:8px; box-sizing:border-box; background:var(--bg-card); color:var(--text-main);">
                <option value="hi">हिंदी (Hindi)</option>
                <option value="en">English</option>
              </select>
            </div>
          </form>
        `,
        `
          <button id="save-new-user-btn" class="btn btn-primary btn-block" style="min-height:48px;">
            ${ui.esc(t('btn.save') || 'Create User')}
          </button>
          <button id="cancel-new-user-btn" class="btn btn-secondary btn-block" style="min-height:48px;">
            ${ui.esc(t('btn.cancel') || 'Cancel')}
          </button>
        `
      );

      var togglePwdBtn = document.getElementById('nu-toggle-pwd');
      var pwdInput = document.getElementById('nu-password');
      if (togglePwdBtn && pwdInput) {
        togglePwdBtn.onclick = function() {
          pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
        };
      }

      var cancelBtn = document.getElementById('cancel-new-user-btn');
      if (cancelBtn) cancelBtn.onclick = ui.closeBottomSheet;

      var saveBtn = document.getElementById('save-new-user-btn');
      if (saveBtn) {
        saveBtn.onclick = async function() {
          var name = document.getElementById('nu-name').value.trim();
          var username = document.getElementById('nu-username').value.trim();
          var phone = document.getElementById('nu-phone').value.trim();
          var role = document.getElementById('nu-role').value;
          var lang = document.getElementById('nu-lang').value;
          var password = document.getElementById('nu-password').value;

          var checkedBranches = [];
          document.querySelectorAll('input[name="nu-branches"]:checked').forEach(function(cb) {
            checkedBranches.push(cb.value);
          });
          var branchVal = checkedBranches.length ? checkedBranches.join(',') : (document.getElementById('nu-branch') ? document.getElementById('nu-branch').value.trim() : 'BR-001');

          if (!name || !username) {
            ui.showToast('Name and Username are required', 'warning');
            return;
          }

          ui.withButtonLoading(saveBtn, async function() {
            try {
              var res = await api.call('users.create', {
                name: name,
                username: username,
                phone: phone,
                role: role,
                branch_ids: branchVal,
                lang: lang,
                password: password || undefined
              });
              ui.closeBottomSheet();
              loadUsers();
              showTempPasswordModal(name, res.temp_password);
            } catch (err) {
              var code = (err && err.code) ? ('err.' + err.code) : 'err.GENERIC';
              var msg = (err && err.fields && err.fields.username === 'DUPLICATE_USERNAME')
                ? (t('err.DUPLICATE_USERNAME') || t('err.DUPLICATE') || err.message)
                : (t(code) || err.message || 'User creation failed');
              ui.showToast(msg, 'error');
            }
          });
        };
      }
    };
  }

  // Filter input
  var searchInput = document.getElementById('users-search-input');
  if (searchInput) {
    searchInput.oninput = function() {
      var query = searchInput.value.toLowerCase().trim();
      if (!query) {
        renderUsers(usersData);
        return;
      }
      var filtered = usersData.filter(function(u) {
        return (u.name || '').toLowerCase().indexOf(query) !== -1 ||
               (u.username || '').toLowerCase().indexOf(query) !== -1 ||
               (u.phone || '').indexOf(query) !== -1;
      });
      renderUsers(filtered);
    };
  }

  loadUsers();
};
