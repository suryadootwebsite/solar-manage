/**
 * settings.js â€” System Settings & User Profile Screen.
 *
 * Implements:
 *   - Doc 03 F-04 (Settings view, system parameters, language switcher, logout).
 *   - Password change modal trigger.
 */

window.pages = window.pages || {};

window.pages.settings = function(container) {
  var t = window.i18n.t;
  var user = window.auth.getUser() || { name: 'Staff User', role: 'SITE_USER', lang: 'hi' };
  var isOwner = window.auth.isOwnerLike(window.auth.getRole());

  container.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto; padding: 1rem 0;">
      <!-- Profile Card -->
      <div class="card" style="margin-bottom: 1rem; padding: 1.25rem;">
        <div style="display:flex; align-items:center; gap:1rem;">
          <div style="width:52px; height:52px; border-radius:50%; background:var(--brand-light); color:var(--brand); display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:700;">
            ${ui.esc((user.name || 'U').charAt(0).toUpperCase())}
          </div>
          <div style="flex:1;">
            <h2 style="font-size:1.2rem; margin:0 0 0.25rem; color:var(--text-main);">${ui.esc(user.name)}</h2>
            <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
              <span class="badge" style="background:var(--brand); color:#fff; font-weight:600;">${ui.esc(user.role)}</span>
              <span style="font-size:0.875rem; color:var(--text-muted);">@${ui.esc(user.username || 'user')}</span>
            </div>
          </div>
        </div>

        <div style="margin-top:1rem; border-top:1px solid var(--border); padding-top:0.75rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button id="open-change-pwd-btn" class="btn btn-secondary" style="min-height:44px; font-size:0.875rem;">
            ðŸ”’ ${ui.esc(t('settings.change_pwd') || 'Change Password')}
          </button>
          <button id="logout-btn" class="btn btn-danger" style="min-height:44px; font-size:0.875rem;">
            ðŸšª ${ui.esc(t('settings.logout') || 'Log Out')}
          </button>
        </div>
      </div>

      <!-- App Preferences -->
      <div class="card" style="margin-bottom: 1rem; padding: 1.25rem;">
        <h3 style="font-size:1.1rem; margin:0 0 1rem; color:var(--text-main);">${ui.esc(t('settings.preferences') || 'Preferences')}</h3>

        <div style="display:flex; justify-content:space-between; align-items:center; min-height:48px;">
          <div>
            <div style="font-weight:600; color:var(--text-main);">${ui.esc(t('settings.lang_label') || 'Interface Language')}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">${ui.esc(t('settings.lang_sub') || 'Switch between Hindi and English')}</div>
          </div>
          <button id="pref-lang-toggle" class="btn btn-secondary" style="min-height:44px; min-width:80px;">
            ${window.i18n.getLang() === 'hi' ? 'à¤¹à¤¿à¤‚à¤¦à¥€ (HI)' : 'English (EN)'}
          </button>
        </div>
      </div>

      <!-- System Settings (Owner Only) -->
      ${isOwner ? `
        <div class="card" style="margin-bottom: 1rem; padding: 1.25rem; overflow:hidden;">
          <h3 style="font-size:1.1rem; margin:0 0 0.5rem; color:var(--text-main);">${ui.esc(t('settings.system_title') || 'System Configuration')}</h3>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:0 0 1rem;">Core parameters & system thresholds</p>

          <div id="settings-loader" style="text-align:center; padding:1rem;">
            <span class="spinner"></span>
          </div>

          <div id="settings-list-container" style="display:none; flex-direction:column; gap:0.75rem;"></div>
        </div>
      ` : ''}

      <!-- About & Diagnostics (Doc 06) -->
      <div class="card" style="margin-bottom: 1rem; padding: 1.25rem;">
        <h3 style="font-size:1.1rem; margin:0 0 0.75rem; color:var(--text-main);">${ui.esc(t('settings.about_title') || 'About & Diagnostics')}</h3>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid var(--border); flex-wrap:wrap; gap:0.5rem;">
          <span style="font-weight:600; color:var(--text-main);">Suryadoot Energy Solution</span>
          <span class="badge" style="background:var(--brand); color:#fff;">v1.0</span>
        </div>
        ${isOwner ? `
          <div style="margin-top:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <div style="font-weight:600; font-size:0.9rem; color:var(--text-main);">Backend Connectivity</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">Run connection speed & diagnostics</div>
            </div>
            <a href="#/ping" class="btn btn-secondary" style="min-height:38px; font-size:0.85rem; text-decoration:none; display:inline-flex; align-items:center;">
              Test Connection
            </a>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Change Password Button
  var changePwdBtn = document.getElementById('open-change-pwd-btn');
  if (changePwdBtn) {
    changePwdBtn.onclick = function() {
      window.showPasswordChangeModal(false);
    };
  }

  // Logout Button
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = function() {
      ui.confirmDialog(
        t('settings.logout_confirm_title') || 'Confirm Logout',
        t('settings.logout_confirm_msg') || 'Are you sure you want to log out of your session?',
        function() {
          ui.withButtonLoading(logoutBtn, async function() {
            try {
              await api.call('auth.logout');
            } catch (e) {
              // ignore network errors on logout
            }
            auth.clearToken();
            ui.showToast(t('settings.logged_out') || 'Logged out successfully', 'info');
            window.location.hash = '#/login';
          });
        }
      );
    };
  }

  // Language toggle
  var langBtn = document.getElementById('pref-lang-toggle');
  if (langBtn) {
    langBtn.onclick = function() {
      ui.withButtonLoading(langBtn, async function() {
        var newLang = window.i18n.toggleLang();
        langBtn.textContent = newLang === 'hi' ? 'à¤¹à¤¿à¤‚à¤¦à¥€ (HI)' : 'English (EN)';
        if (auth.isAuthenticated()) {
          try {
            await api.call('auth.setLang', { lang: newLang });
          } catch (e) {
            // offline or background error
          }
        }
      });
    };
  }

  // Load System Settings if Owner
  if (isOwner) {
    (async function() {
      var loader = document.getElementById('settings-loader');
      var listDiv = document.getElementById('settings-list-container');
      try {
        var settingsMap = await api.call('settings.get');
        if (loader) loader.style.display = 'none';
        if (listDiv) {
          listDiv.style.display = 'flex';
          function renderSettingValue(key, val) {
            if (typeof val === 'boolean' || val === 'true' || val === 'false') {
              var boolVal = String(val) === 'true';
              return '<span class="badge" style="background:' + (boolVal ? 'var(--brand)' : '#6b7280') + ';color:#fff;">' + (boolVal ? 'ON' : 'OFF') + '</span>';
            }
            if (key === 'stage_material_hints') {
              try {
                var parsed = JSON.parse(val);
                if (typeof parsed === 'object') {
                  return '<span style="font-size:0.8rem;color:var(--text-muted);">Configured (' + Object.keys(parsed).length + ' stages)</span>';
                }
              } catch(e) {}
              return val === 'true' ? '<span class="badge" style="background:var(--brand);color:#fff;">ON (all stages)</span>' :
                     val === 'false' ? '<span class="badge" style="background:#6b7280;color:#fff;">OFF</span>' :
                     '<span style="font-size:0.8rem;color:var(--text-muted);">Custom config</span>';
            }
            return '<span>' + window.ui.esc(String(val)) + '</span>';
          }
          var html = Object.keys(settingsMap).map(function(key) {
            var label = t('settings.key.' + key);
            if (!label || label === 'Information unavailable' || label === 'à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆ') {
              label = key;
            }
            var desc = t('settings.desc.' + key);
            if (!desc || desc === 'Information unavailable' || desc === 'à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆ') {
              desc = '';
            }
            var val = settingsMap[key];
            return `
              <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:0.6rem 0; border-bottom:1px solid var(--border); flex-wrap:wrap; gap:0.5rem;">
                <div style="flex:1; min-width:140px;">
                  <div style="font-weight:600; font-size:0.9rem; color:var(--text-main); word-break:break-word;">${ui.esc(label)}</div>
                  ${desc ? `<div style="font-size:0.8rem; color:var(--text-muted); margin:0.15rem 0;">${ui.esc(desc)}</div>` : ''}
                  <code style="font-size:0.75rem; color:var(--text-muted);">${ui.esc(key)}</code>
                </div>
                <div style="text-align:right;">
                  ${renderSettingValue(key, val)}
                </div>
              </div>
            `;
          }).join('');
          listDiv.innerHTML = html;
        }
      } catch (err) {
        if (loader) loader.innerHTML = `<span style="color:var(--text-muted); font-size:0.875rem;">Settings unavailable in offline mode.</span>`;
      }
    })();

    // B10: Performance card â€” slow requests (OWNER/DEVELOPER only)
    (async function() {
      var perfCard = document.createElement('div');
      perfCard.className = 'card';
      perfCard.style.cssText = 'padding:1rem;margin-top:1rem;';
      perfCard.innerHTML = '<h3 style="margin:0 0 0.75rem;font-size:1.05rem;">\u26a1 Performance \u2014 Slow Requests</h3><div id="settings-slowlog"><span class="spinner"></span></div>';
      var cont = document.getElementById('settings-list-container');
      if (cont && cont.parentNode) cont.parentNode.appendChild(perfCard);
      try {
        var slowRes = await api.call('system.slowLog', {});
        var rows = (slowRes && slowRes.items) || [];
        var el = document.getElementById('settings-slowlog');
        if (!el) return;
        if (!rows.length) {
          el.innerHTML = '<span style="color:var(--text-muted);font-size:0.875rem;">No slow requests recorded yet.</span>';
        } else {
          el.innerHTML = '<table style="width:100%;font-size:0.8rem;border-collapse:collapse;">' +
            '<tr style="border-bottom:1px solid var(--border);"><th style="text-align:left;padding:0.25rem 0.1rem;">Action</th><th style="text-align:right;padding:0.25rem 0.1rem;">ms</th><th style="text-align:right;padding:0.25rem 0.1rem;">Sheets</th><th style="text-align:right;padding:0.25rem 0.1rem;">Time</th></tr>' +
            rows.map(function(r) {
              return '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:0.25rem 0.1rem;">' + ui.esc(r.action || '') + '</td>' +
                '<td style="text-align:right;padding:0.25rem 0.1rem;color:' + ((r.ms || 0) > 3000 ? '#dc2626' : '#d97706') + ';">' + (r.ms || "") + '</td>' +
                '<td style="text-align:right;padding:0.25rem 0.1rem;">' + (ui.esc((r.message||'').replace(/^.*sheets: /,'').substring(0,30))) + '</td>' +
                '<td style="text-align:right;padding:0.25rem 0.1rem;color:var(--text-muted);">' + ui.esc((r.timestamp||'').substring(0,16)) + '</td>' +
                '</tr>';
            }).join('') + '</table>';
        }
      } catch (e) {
        var el2 = document.getElementById('settings-slowlog');
        if (el2) el2.innerHTML = '<span style="color:var(--text-muted);font-size:0.875rem;">Slow log unavailable.</span>';
      }
    })();

    // System Backup & Drive Storage Card (OWNER/DEVELOPER only)
    (async function() {
      var backupCard = document.createElement('div');
      backupCard.className = 'card';
      backupCard.style.cssText = 'padding:1rem;margin-top:1rem;';
      backupCard.innerHTML = '<h3 style="margin:0 0 0.75rem;font-size:1.05rem;">💾 Database Backup & Drive Storage</h3><div id="settings-backup-info"><span class="spinner"></span></div>';
      var cont = document.getElementById('settings-list-container');
      if (cont && cont.parentNode) cont.parentNode.appendChild(backupCard);

      try {
        var info = await api.call('system.backupStatus', {});
        var el = document.getElementById('settings-backup-info');
        if (!el) return;

        var pct = info.storage_usage_pct || 0;
        var warnBadge = '';
        if (pct >= 85) {
          warnBadge = '<div style="background:#fee2e2;color:#991b1b;padding:0.5rem;border-radius:6px;margin-bottom:0.75rem;font-size:0.8rem;font-weight:600;">🚨 Critical Drive Storage: ' + pct + '% used. Free up space immediately.</div>';
        } else if (pct >= 70) {
          warnBadge = '<div style="background:#fef3c7;color:#92400e;padding:0.5rem;border-radius:6px;margin-bottom:0.75rem;font-size:0.8rem;font-weight:600;">⚠️ Drive Storage Warning: ' + pct + '% used.</div>';
        }

        var usedMB = (info.storage_used_bytes / (1024 * 1024)).toFixed(1);
        var limitGB = (info.storage_limit_bytes / (1024 * 1024 * 1024)).toFixed(1);
        var sizeMB = ((info.last_backup_size_bytes || 0) / (1024 * 1024)).toFixed(2);
        var statusColor = (info.last_backup_status || '').indexOf('SUCCESS') !== -1 ? 'var(--color-success, #16a34a)' : (info.last_backup_status === 'NONE' ? 'var(--text-muted)' : '#dc2626');

        el.innerHTML = warnBadge +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;font-size:0.85rem;margin-bottom:0.75rem;">' +
            '<div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Last Backup Status</span><b style="color:' + statusColor + ';">' + ui.esc(info.last_backup_status || 'None') + '</b></div>' +
            '<div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Last Backup Time</span><b>' + ui.esc(info.last_backup_at || 'Never') + '</b></div>' +
            '<div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Backup Size</span><b>' + (sizeMB > 0 ? sizeMB + ' MB' : '—') + '</b></div>' +
            '<div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Retained Copies</span><b>' + (info.backup_count || 0) + ' files</b></div>' +
          '</div>' +
          '<div style="font-size:0.8rem;margin-bottom:0.75rem;">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;"><span>Drive Storage Used:</span><span>' + usedMB + ' MB / ' + limitGB + ' GB (' + pct + '%)</span></div>' +
            '<div style="background:var(--border, #e2e8f0);height:8px;border-radius:4px;overflow:hidden;"><div style="background:' + (pct >= 85 ? '#dc2626' : (pct >= 70 ? '#f59e0b' : '#16a34a')) + ';width:' + Math.min(pct, 100) + '%;height:100%;"></div></div>' +
          '</div>' +
          '<button id="btn-run-backup" class="btn btn-secondary btn-sm" style="width:100%;font-size:0.8rem;">Run Backup Now</button>';

        var runBtn = document.getElementById('btn-run-backup');
        if (runBtn) {
          runBtn.addEventListener('click', async function() {
            await ui.withButtonLoading(runBtn, async function() {
              try {
                var res = await api.call('system.runBackup', {});
                ui.showToast('Backup created & verified: ' + (res && res.name || 'OK'), 'success');
                setTimeout(function() { window.location.reload(); }, 1200);
              } catch(bErr) {
                ui.showToast('Backup failed: ' + (bErr.message || 'Error'), 'error');
              }
            });
          });
        }
      } catch (e) {
        var el2 = document.getElementById('settings-backup-info');
        if (el2) el2.innerHTML = '<span style="color:var(--text-muted);font-size:0.875rem;">Backup info unavailable.</span>';
      }
    })();

    // System Integrity & Health Card (OWNER/DEVELOPER only)
    (async function() {
      var healthCard = document.createElement('div');
      healthCard.className = 'card';
      healthCard.style.cssText = 'padding:1rem;margin-top:1rem;';
      healthCard.innerHTML = '<h3 style="margin:0 0 0.75rem;font-size:1.05rem;">🩺 System Health & Data Integrity</h3><div id="settings-health-info"><span class="spinner"></span></div>';
      var cont = document.getElementById('settings-list-container');
      if (cont && cont.parentNode) cont.parentNode.appendChild(healthCard);

      try {
        var hInfo = await api.call('system.health', {});
        var hEl = document.getElementById('settings-health-info');
        if (!hEl) return;

        var isHealthy = hInfo.status === 'HEALTHY';
        var statusBadge = isHealthy
          ? '<span style="background:#dcfce7;color:#166534;padding:0.25rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:700;">HEALTHY</span>'
          : '<span style="background:#fee2e2;color:#991b1b;padding:0.25rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:700;">DEGRADED</span>';

        var lastInt = hInfo.integrity || {};
        var intStatusColor = lastInt.last_integrity_status === 'PASS' ? 'var(--color-success, #16a34a)' : (lastInt.last_integrity_status === 'NONE' ? 'var(--text-muted)' : '#dc2626');

        hEl.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
            '<span style="font-size:0.85rem;color:var(--text-muted);">Overall System Status:</span>' +
            statusBadge +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;font-size:0.85rem;margin-bottom:0.75rem;">' +
            '<div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">12-Point Integrity</span><b style="color:' + intStatusColor + ';">' + ui.esc(lastInt.last_integrity_status || 'Not run') + '</b></div>' +
            '<div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Last Integrity Check</span><b>' + ui.esc(lastInt.last_integrity_at || 'Never') + '</b></div>' +
            '<div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Errors (last 24h)</span><b style="color:' + (hInfo.errors_24h > 0 ? '#dc2626' : 'inherit') + ';">' + (hInfo.errors_24h || 0) + '</b></div>' +
            '<div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Pending Operations</span><b style="color:' + (hInfo.pending_ops > 0 ? '#dc2626' : 'inherit') + ';">' + (hInfo.pending_ops || 0) + '</b></div>' +
          '</div>' +
          '<div style="display:flex;gap:0.5rem;">' +
            '<button id="btn-run-integrity" class="btn btn-secondary btn-sm" style="flex:1;font-size:0.8rem;">Run Integrity Check</button>' +
            '<button id="btn-view-audit" class="btn btn-outline btn-sm" style="flex:1;font-size:0.8rem;">View Audit Trail</button>' +
          '</div>';

        var runIntBtn = document.getElementById('btn-run-integrity');
        if (runIntBtn) {
          runIntBtn.addEventListener('click', async function() {
            await ui.withButtonLoading(runIntBtn, async function() {
              try {
                var iRes = await api.call('system.runIntegrity', {});
                if (iRes && iRes.status === 'PASS') {
                  ui.showToast('All 12 integrity checks PASSED (0 mismatches)', 'success');
                } else {
                  ui.showToast('Integrity check: ' + (iRes.failed_count || 0) + ' findings detected', 'error');
                }
                setTimeout(function() { window.location.reload(); }, 1200);
              } catch(iErr) {
                ui.showToast('Integrity run failed: ' + (iErr.message || 'Error'), 'error');
              }
            });
          });
        }

        var viewAudBtn = document.getElementById('btn-view-audit');
        if (viewAudBtn) {
          viewAudBtn.addEventListener('click', async function() {
            await ui.withButtonLoading(viewAudBtn, async function() {
              try {
                var aRes = await api.call('audit.list', { limit: 15 });
                var items = (aRes && aRes.items) || [];
                if (items.length === 0) {
                  ui.showToast('No audit entries recorded yet.', 'info');
                } else {
                  var auditHtml = '<div style="max-height:350px;overflow-y:auto;font-size:0.8rem;">';
                  items.forEach(function(it) {
                    auditHtml += '<div style="border-bottom:1px solid var(--border,#e2e8f0);padding:0.5rem 0;">' +
                      '<div style="display:flex;justify-content:space-between;color:var(--text-muted);font-size:0.7rem;"><span>' + ui.esc(it.action || '') + ' (' + ui.esc(it.user_id || '') + ')</span><span>' + ui.esc(it.timestamp || '') + '</span></div>' +
                      '<div style="font-weight:600;margin-top:0.2rem;">' + ui.esc(it.summary || (it.entity + ' ' + it.entity_id)) + '</div>' +
                    '</div>';
                  });
                  auditHtml += '</div>';
                  ui.openBottomSheet('Audit Trail (' + items.length + ')', auditHtml, '');
                }
              } catch (aErr) {
                ui.showToast('Could not load audit log: ' + aErr.message, 'error');
              }
            });
          });
        }
      } catch (hErr) {
        var hEl2 = document.getElementById('settings-health-info');
        if (hEl2) hEl2.innerHTML = '<span style="color:var(--text-muted);font-size:0.875rem;">Health info unavailable.</span>';
      }
    })();
  }
};
