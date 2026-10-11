/**
 * pages/ping.js — Backend Ping & Health Diagnostic Component.
 *
 * Verifies live connectivity with the Google Apps Script backend
 * by executing the system.ping action.
 *
 * Doc ref: Doc 05 §2, Doc 09 S03
 */

window.pages = window.pages || {};

window.pages.ping = function(container) {
  var t = window.i18n.t;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">${t('ping.title')}</h2>
        <span id="ping-status-badge" class="badge badge-info">
          <span class="status-dot"></span>
          <span id="ping-status-text">${t('ping.idle')}</span>
        </span>
      </div>

      <p style="color:var(--text-muted); font-size:0.9375rem;">
        ${t('ping.desc')}
      </p>

      <div style="background-color:var(--surface-alt); border:1px solid var(--border-light); border-radius:var(--radius-sm); padding:1rem; margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <strong style="font-size:0.875rem;">${t('ping.latency')}:</strong>
          <span id="ping-latency-val" style="font-family:monospace; font-weight:700;">--</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <strong style="font-size:0.875rem;">${t('ping.server_time')}:</strong>
          <span id="ping-time-val" style="font-family:monospace; font-size:0.875rem;">--</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <strong style="font-size:0.875rem;">${t('ping.api_version')}:</strong>
          <span id="ping-v-val" style="font-family:monospace; font-weight:700;">--</span>
        </div>
      </div>

      <button id="run-ping-btn" class="btn btn-primary btn-block">
        ${t('ping.run_btn')}
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${t('ping.device_diagnostics')}</h3>
      </div>
      <div style="font-size:0.875rem; color:var(--text-muted); display:flex; flex-direction:column; gap:0.5rem;">
        <div style="display:flex; justify-content:space-between;">
          <span>${t('ping.viewport_width')}:</span>
          <strong style="color:var(--text-main);">${window.innerWidth}px</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>${t('ping.pwa_mode')}:</span>
          <strong style="color:var(--text-main);">${window.matchMedia('(display-mode: standalone)').matches ? 'Standalone (PWA)' : 'Browser'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>${t('ping.network_status')}:</span>
          <strong id="client-network-text" style="color:var(--text-main);">${navigator.onLine ? t('status.online') : t('status.offline')}</strong>
        </div>
      </div>
    </div>
  `;

  var pingBtn = document.getElementById('run-ping-btn');
  if (pingBtn) {
    pingBtn.onclick = function() {
      window.ui.withButtonLoading(pingBtn, executePing);
    };
  }

  async function executePing() {
    var statusBadge = document.getElementById('ping-status-badge');
    var statusText = document.getElementById('ping-status-text');
    var latencyVal = document.getElementById('ping-latency-val');
    var timeVal = document.getElementById('ping-time-val');
    var vVal = document.getElementById('ping-v-val');

    statusText.textContent = t('ping.connecting');
    statusBadge.className = 'badge badge-warning';

    var startTime = Date.now();

    try {
      var res = await window.api.call('system.ping', {}, { skipAuth: true });
      var elapsed = Date.now() - startTime;

      statusText.textContent = t('ping.success');
      statusBadge.className = 'badge badge-success';

      var headerDot = document.getElementById('header-status-dot');
      if (headerDot) {
        headerDot.className = 'status-dot online';
      }

      latencyVal.textContent = elapsed + ' ms';
      timeVal.textContent = (res && res.time) ? res.time : new Date().toLocaleTimeString();
      vVal.textContent = window.APP_CONFIG.API_VERSION;

      window.ui.showToast(t('ping.toast_success', { ms: elapsed }), 'success');

    } catch (err) {
      statusText.textContent = t('ping.failed');
      statusBadge.className = 'badge badge-danger';

      var headerDot = document.getElementById('header-status-dot');
      if (headerDot) {
        headerDot.className = 'status-dot offline';
      }

      latencyVal.textContent = 'Err';
      timeVal.textContent = '--';
      vVal.textContent = '--';

      window.ui.showToast(err.message || t('ping.toast_failed'), 'error');
    }
  }

  // Auto-run ping on initial load if online
  if (navigator.onLine) {
    setTimeout(executePing, 400);
  }
};
