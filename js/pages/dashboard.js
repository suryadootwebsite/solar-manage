/**
 * js/pages/dashboard.js — Executive & Operational Dashboard Page.
 *
 * Enforces:
 *   - Doc 03 F-24: Role-specific dashboard widgets.
 *   - OWNER: Stage counts, stuck sites alert, low stock, stock valuation, customer receivables, supplier payables, month profit.
 *   - MANAGER: Stage counts, stuck sites alert, low stock, today IN/OUT qty, pending transfers. (Zero financial metrics).
 *   - SITE_USER: Assigned sites, pending stage tasks.
 *   - Mobile first, 48px tap targets, high contrast badges.
 */

(function() {
  window.pages = window.pages || {};

  function render(container) {
    var t = window.i18n.t;
    var ui = window.ui;
    var api = window.api;
    var role = (window.auth.getUser() && window.auth.getUser().role) || 'SITE_USER';

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-title">' + ui.esc(t('dash.title')) + '</h1>' +
          '<p class="page-subtitle">' + ui.esc(t('dash.subtitle')) + '</p>' +
        '</div>' +
        '<div class="page-actions">' +
          (role === 'OWNER' || role === 'MANAGER' ?
            '<a href="#/reports" class="btn btn-secondary" style="min-height:48px;display:inline-flex;align-items:center;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>' +
              ui.esc(t('dash.quick_reports')) +
            '</a>' : '') +
          '<button id="dash-refresh-btn" class="btn btn-primary" style="min-height:48px;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>' +
            ui.esc(t('btn.retry')) +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div id="dash-content">' +
        '<div class="card" style="text-align:center;padding:2rem;">' +
          '<div class="spinner" style="margin:0 auto 1rem;"></div>' +
          '<p class="text-muted">' + ui.esc(t('rep.loading')) + '</p>' +
        '</div>' +
      '</div>';

    var refreshBtn = container.querySelector('#dash-refresh-btn');
    var contentEl = container.querySelector('#dash-content');

    function loadDashboard() {
      contentEl.innerHTML =
        '<div class="card" style="text-align:center;padding:2rem;">' +
          '<div class="spinner" style="margin:0 auto 1rem;"></div>' +
          '<p class="text-muted">' + ui.esc(t('rep.loading')) + '</p>' +
        '</div>';

      api.call('dashboard.get', {})
        .then(function(dash) {
          renderDashboardData(contentEl, dash, role);
        })
        .catch(function(err) {
          contentEl.innerHTML =
            '<div class="card card-error" style="padding:1.5rem;">' +
              '<h3>' + ui.esc(t('ping.failed')) + '</h3>' +
              '<p class="text-muted">' + ui.esc(err.message || 'Error loading dashboard') + '</p>' +
            '</div>';
        });
    }

    refreshBtn.addEventListener('click', loadDashboard);
    loadDashboard();
  }

  function renderDashboardData(contentEl, dash, role) {
    var t = window.i18n.t;
    var ui = window.ui;
    var html = '';

    // KPI Cards Grid
    html += '<div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:1rem;margin-bottom:1.5rem;">';

    if (role === 'OWNER') {
      html +=
        kpiCard(t('dash.active_sites'), dash.active_sites_count || 0, 'var(--brand)') +
        kpiCard(t('dash.stuck_sites'), dash.stuck_count || 0, dash.stuck_count > 0 ? '#dc2626' : 'var(--text-muted)') +
        kpiCard(t('dash.stock_value'), formatCurrency(dash.stock_value_paise || 0), '#059669') +
        kpiCard(t('dash.receivable'), formatCurrency(dash.receivable_paise || 0), '#2563eb') +
        kpiCard(t('dash.payable'), formatCurrency(dash.payable_paise || 0), '#d97706') +
        kpiCard(t('dash.month_profit'), formatCurrency(dash.month_profit_paise || 0), (dash.month_profit_paise || 0) >= 0 ? '#059669' : '#dc2626');
    } else if (role === 'MANAGER') {
      html +=
        kpiCard(t('dash.active_sites'), dash.active_sites_count || 0, 'var(--brand)') +
        kpiCard(t('dash.stuck_sites'), dash.stuck_count || 0, dash.stuck_count > 0 ? '#dc2626' : 'var(--text-muted)') +
        kpiCard(t('dash.today_in'), dash.today_in_qty || 0, '#059669') +
        kpiCard(t('dash.today_out'), dash.today_out_qty || 0, '#2563eb') +
        kpiCard(t('dash.pending_transfers'), dash.pending_transfers_count || 0, '#d97706');
    } else if (role === 'SITE_USER') {
      html +=
        kpiCard(t('dash.my_sites'), (dash.my_sites || []).length, 'var(--brand)') +
        kpiCard(t('dash.pending_stages'), dash.my_pending_stages_count || 0, '#d97706');
    }

    html += '</div>';

    // Stuck Sites Alert (if any)
    if (dash.stuck_sites && dash.stuck_sites.length > 0) {
      html +=
        '<div class="card" style="border-left:4px solid #dc2626;margin-bottom:1.5rem;">' +
          '<h3 style="color:#dc2626;margin-bottom:0.75rem;display:flex;align-items:center;font-size:1.1rem;">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' +
            ui.esc(t('dash.stuck_alert')) +
          '</h3>' +
          '<div class="table-responsive">' +
            '<table class="data-table">' +
              '<thead>' +
                '<tr>' +
                  '<th>Site</th>' +
                  '<th>Stage</th>' +
                  '<th>Duration</th>' +
                  '<th>Capacity</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                dash.stuck_sites.map(function(s) {
                  return '<tr>' +
                    '<td><a href="#/sites/' + encodeURIComponent(s.site_id) + '" style="font-weight:600;color:var(--brand);">' + ui.esc(s.site_name) + '</a></td>' +
                    '<td><span class="badge badge-warning">' + ui.esc(s.current_stage) + '</span></td>' +
                    '<td><strong style="color:#dc2626;">' + s.days_in_stage + ' ' + ui.esc(t('dash.days')) + '</strong></td>' +
                    '<td>' + (s.system_kw ? s.system_kw + ' kW' : '-') + '</td>' +
                  '</tr>';
                }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>';
    }

    // Low Stock Alert
    if (dash.low_stock && dash.low_stock.length > 0) {
      html +=
        '<div class="card" style="border-left:4px solid #d97706;margin-bottom:1.5rem;">' +
          '<h3 style="color:#d97706;margin-bottom:0.75rem;display:flex;align-items:center;font-size:1.1rem;">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' +
            ui.esc(t('dash.low_stock')) +
          '</h3>' +
          '<div class="table-responsive">' +
            '<table class="data-table">' +
              '<thead>' +
                '<tr>' +
                  '<th>Product</th>' +
                  '<th>Category</th>' +
                  '<th>' + ui.esc(t('dash.avail')) + '</th>' +
                  '<th>' + ui.esc(t('dash.min')) + '</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                dash.low_stock.map(function(p) {
                  return '<tr>' +
                    '<td><strong>' + ui.esc(p.name) + '</strong></td>' +
                    '<td><span class="badge">' + ui.esc(p.category) + '</span></td>' +
                    '<td><span style="color:#dc2626;font-weight:700;">' + p.available + ' ' + (p.unit || '') + '</span></td>' +
                    '<td>' + p.threshold + '</td>' +
                  '</tr>';
                }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>';
    }

    // Site User: My Sites List
    if (role === 'SITE_USER' && dash.my_sites) {
      html +=
        '<div class="card" style="margin-bottom:1.5rem;">' +
          '<h3 style="margin-bottom:1rem;font-size:1.1rem;">' + ui.esc(t('dash.my_sites')) + '</h3>' +
          '<div class="table-responsive">' +
            '<table class="data-table">' +
              '<thead>' +
                '<tr>' +
                  '<th>Site Name</th>' +
                  '<th>Current Stage</th>' +
                  '<th>Status</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                dash.my_sites.map(function(s) {
                  return '<tr>' +
                    '<td><a href="#/sites/' + encodeURIComponent(s.site_id) + '" style="font-weight:600;color:var(--brand);">' + ui.esc(s.site_name) + '</a></td>' +
                    '<td><span class="badge badge-info">' + ui.esc(s.current_stage) + '</span></td>' +
                    '<td><span class="badge">' + ui.esc(s.status) + '</span></td>' +
                  '</tr>';
                }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>';
    }

    // Stage Distribution Breakdown
    if (dash.stage_counts && Object.keys(dash.stage_counts).length > 0) {
      html +=
        '<div class="card">' +
          '<h3 style="margin-bottom:1rem;font-size:1.1rem;">' + ui.esc(t('dash.stage_breakdown')) + '</h3>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:0.75rem;">' +
            Object.keys(dash.stage_counts).map(function(stageName) {
              return '<div style="background:var(--bg-subtle,#f8fafc);border:1px solid var(--border-color,#e2e8f0);padding:0.75rem;border-radius:8px;">' +
                '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px;">' + ui.esc(stageName) + '</div>' +
                '<div style="font-size:1.3rem;font-weight:700;color:var(--text);">' + dash.stage_counts[stageName] + '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
    }

    contentEl.innerHTML = html;
  }

  function kpiCard(title, value, color) {
    return '<div class="card" style="padding:1rem;border-top:3px solid ' + color + ';text-align:left;">' +
      '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window.ui.esc(title) + '</div>' +
      '<div style="font-size:1.4rem;font-weight:700;color:' + color + ';">' + value + '</div>' +
    '</div>';
  }

  function formatCurrency(paise) {
    if (!paise || paise === 0) return '₹0';
    var rupees = Math.round(paise / 100);
    return '₹' + rupees.toLocaleString('en-IN');
  }

  window.pages.dashboard = render;
})();
