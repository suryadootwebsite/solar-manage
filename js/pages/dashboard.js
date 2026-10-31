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
          (window.auth.isOwnerLike(role) || role === 'MANAGER' ?
            '<a href="#/reports" class="btn btn-secondary" style="min-height:48px;display:inline-flex;align-items:center;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>' +
              ui.esc(t('dash.quick_reports')) +
            '</a>' : '') +
          '<button id="dash-refresh-btn" class="btn btn-primary" style="min-height:48px;display:none;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>' +
            ui.esc(t('btn.retry')) +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div id="dash-content"></div>';

    var refreshBtn = container.querySelector('#dash-refresh-btn');
    var contentEl = container.querySelector('#dash-content');

    function renderSkeleton() {
      contentEl.innerHTML =
        '<div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:1rem;margin-bottom:1.5rem;">' +
          '<div class="card skeleton" style="height:100px;"></div>' +
          '<div class="card skeleton" style="height:100px;"></div>' +
          '<div class="card skeleton" style="height:100px;"></div>' +
          '<div class="card skeleton" style="height:100px;"></div>' +
        '</div>' +
        '<div class="card skeleton" style="height:180px;margin-bottom:1.5rem;"></div>' +
        '<div class="card skeleton" style="height:180px;"></div>';
    }

    var dNow = new Date();
    var defaultMonth = String(dNow.getMonth() + 1).padStart(2, '0');
    var defaultYear = String(dNow.getFullYear());
    var selMonth = defaultMonth;
    var selYear = defaultYear;
    try {
      var sm = localStorage.getItem('sms_dash_sel_month');
      var sy = localStorage.getItem('sms_dash_sel_year');
      if (sm !== null) selMonth = sm;
      if (sy !== null) selYear = sy;
    } catch (e) {}

    function getCacheKey() {
      return 'sms_cache_dashboard_' + role + '_' + selMonth + '_' + selYear;
    }

    function loadDashboard(forceRefresh) {
      var cacheKey = getCacheKey();
      var cached = null;
      if (!forceRefresh) {
        try {
          var raw = sessionStorage.getItem(cacheKey);
          if (raw) cached = JSON.parse(raw);
        } catch (e) {}
      }

      function handlePeriodChange(newMonth, newYear) {
        selMonth = newMonth;
        selYear = newYear;
        try {
          sessionStorage.removeItem(getCacheKey());
        } catch (e) {}
        loadDashboard(true);
      }

      if (cached) {
        renderDashboardData(contentEl, cached, role, handlePeriodChange);
        refreshBtn.style.display = 'none';
      } else {
        renderSkeleton();
        refreshBtn.style.display = 'none';
      }

      // 2. Fetch fresh data with selected period
      api.call('dashboard.get', { period: { month: selMonth, year: selYear } })
        .then(function(dash) {
          try {
            sessionStorage.setItem(getCacheKey(), JSON.stringify(dash));
          } catch (e) {}
          renderDashboardData(contentEl, dash, role, handlePeriodChange);
          refreshBtn.style.display = 'none';
        })
        .catch(function(err) {
          if (!cached) {
            contentEl.innerHTML =
              '<div class="card card-error" style="padding:1.5rem;text-align:center;">' +
                '<h3 style="color:#dc2626;margin-bottom:0.5rem;">' + ui.esc(t('dash.failed')) + '</h3>' +
                '<p class="text-muted" style="margin-bottom:1rem;">' + ui.esc(err.message || t('err.GENERIC')) + '</p>' +
              '</div>';
            refreshBtn.style.display = 'inline-flex';
          } else {
            ui.toast(err.message || t('dash.failed'), 'error');
          }
        });
    }

    refreshBtn.addEventListener('click', function() {
      loadDashboard(true);
    });
    loadDashboard();
  }

  var ownerView = 'financial'; // 'financial' or 'operations'

  function renderDashboardData(contentEl, dash, role, onPeriodChange) {
    var t = window.i18n.t;
    var ui = window.ui;
    var html = '';

    var isOwner = window.auth.isOwnerLike(role);

    // Toggle for OWNER/DEVELOPER
    if (isOwner) {
      html +=
        '<div style="display:flex;gap:0.5rem;margin-bottom:1rem;">' +
          '<button id="dash-view-financial" class="btn ' + (ownerView === 'financial' ? 'btn-primary' : 'btn-secondary') + '" style="min-height:38px;padding:0.4rem 0.8rem;font-size:0.85rem;">' +
            ui.esc(t('dash.financial_overview') || 'Financial Overview') +
          '</button>' +
          '<button id="dash-view-operations" class="btn ' + (ownerView === 'operations' ? 'btn-primary' : 'btn-secondary') + '" style="min-height:38px;padding:0.4rem 0.8rem;font-size:0.85rem;">' +
            ui.esc(t('dash.operations_overview') || 'Operations Overview') +
          '</button>' +
        '</div>';
    }

    // Month & Year Filter Dropdowns
    var curYr = new Date().getFullYear();
    var yearOptions = ['ALL', curYr, curYr - 1, curYr - 2, curYr - 3, curYr - 4, curYr - 5];
    var monthOptions = [
      { val: 'ALL', label: t('dash.month_all') || 'All Months' },
      { val: '01', label: t('dash.month_01') || 'Jan' },
      { val: '02', label: t('dash.month_02') || 'Feb' },
      { val: '03', label: t('dash.month_03') || 'Mar' },
      { val: '04', label: t('dash.month_04') || 'Apr' },
      { val: '05', label: t('dash.month_05') || 'May' },
      { val: '06', label: t('dash.month_06') || 'Jun' },
      { val: '07', label: t('dash.month_07') || 'Jul' },
      { val: '08', label: t('dash.month_08') || 'Aug' },
      { val: '09', label: t('dash.month_09') || 'Sep' },
      { val: '10', label: t('dash.month_10') || 'Oct' },
      { val: '11', label: t('dash.month_11') || 'Nov' },
      { val: '12', label: t('dash.month_12') || 'Dec' }
    ];
    var activePeriod = dash.period || { month: selMonth, year: selYear };

    html += '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;background:var(--bg-main, #f9fafb);padding:0.6rem 0.75rem;border-radius:8px;border:1px solid var(--border-color, #e5e7eb);">' +
      '<span style="font-size:0.85rem;font-weight:600;color:var(--text-muted);display:inline-flex;align-items:center;gap:0.3rem;">📅 ' + ui.esc(t('dash.period') || 'Period') + ':</span>' +
      '<select id="dash-filter-month" class="input" style="width:auto;min-width:110px;padding:0.25rem 0.5rem;font-size:0.85rem;min-height:36px;">' +
        monthOptions.map(function(m) {
          return '<option value="' + m.val + '" ' + (String(activePeriod.month) === String(m.val) ? 'selected' : '') + '>' + m.label + '</option>';
        }).join('') +
      '</select>' +
      '<select id="dash-filter-year" class="input" style="width:auto;min-width:95px;padding:0.25rem 0.5rem;font-size:0.85rem;min-height:36px;">' +
        yearOptions.map(function(y) {
          return '<option value="' + y + '" ' + (String(activePeriod.year) === String(y) ? 'selected' : '') + '>' + (y === 'ALL' ? (t('dash.year_all') || 'All Years') : y) + '</option>';
        }).join('') +
      '</select>' +
    '</div>';

    // KPI Cards Grid
    html += '<div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:1rem;margin-bottom:1.5rem;">';

    if (isOwner && ownerView === 'operations') {
      html +=
        kpiCard(t('dash.followups_due_today') || 'Follow-ups Today', dash.followups_due_today || 0, '#ea580c') + kpiCard(t('dash.active_sites'), dash.active_sites_count || 0, 'var(--brand)') +
        kpiCard(t('dash.stuck_sites'), dash.stuck_count || 0, dash.stuck_count > 0 ? '#dc2626' : 'var(--text-muted)') +
        kpiCard(t('dash.today_in'), dash.today_in_qty || 0, '#059669') +
        kpiCard(t('dash.today_out'), dash.today_out_qty || 0, '#2563eb') +
        kpiCard(t('dash.pending_transfers'), dash.pending_transfers_count || 0, '#d97706');
    } else if (isOwner) {
      html +=
        kpiCard(t('dash.active_sites'), dash.active_sites_count || 0, 'var(--brand)') +
        kpiCard(t('dash.stuck_sites'), dash.stuck_count || 0, dash.stuck_count > 0 ? '#dc2626' : 'var(--text-muted)') +
        kpiCard(t('dash.stock_value'), formatCurrency(dash.stock_value_paise || 0), '#059669') +
        kpiCard(t('dash.receivable'), formatCurrency(dash.receivable_paise || 0), '#2563eb') +
        kpiCard(t('dash.payable'), formatCurrency(dash.payable_paise || 0), '#d97706') +
        kpiCard(t('dash.month_profit'), formatCurrency(dash.month_profit_paise || 0), (dash.month_profit_paise || 0) >= 0 ? '#059669' : '#dc2626');
    } else if (role === 'MANAGER' || role === 'VIEW_ONLY') {
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
                  '<th>Duration / Reason</th>' +
                  '<th>Capacity</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                dash.stuck_sites.map(function(s) {
                  return '<tr>' +
                    '<td><a href="#/sites/' + encodeURIComponent(s.site_id) + '" style="font-weight:600;color:var(--brand);">' + ui.esc(s.site_name) + '</a></td>' +
                    '<td><span class="badge badge-warning">' + ui.esc(s.current_stage) + '</span></td>' +
                    '<td><strong style="color:#dc2626;">' + s.days_in_stage + ' ' + ui.esc(t('dash.days')) + '</strong>' +
                      (s.reason ? '<div style="font-size:0.75rem;color:#dc2626;margin-top:2px;">' + ui.esc(s.reason) + '</div>' : '') +
                    '</td>' +
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

    var mFilter = contentEl.querySelector('#dash-filter-month');
    var yFilter = contentEl.querySelector('#dash-filter-year');
    if (mFilter) {
      mFilter.onchange = function() {
        var vm = this.value;
        try { localStorage.setItem('sms_dash_sel_month', vm); } catch(e) {}
        if (typeof onPeriodChange === 'function') {
          onPeriodChange(vm, yFilter ? yFilter.value : 'ALL');
        }
      };
    }
    if (yFilter) {
      yFilter.onchange = function() {
        var vy = this.value;
        try { localStorage.setItem('sms_dash_sel_year', vy); } catch(e) {}
        if (typeof onPeriodChange === 'function') {
          onPeriodChange(mFilter ? mFilter.value : 'ALL', vy);
        }
      };
    }

    if (isOwner) {
      var finBtn = contentEl.querySelector('#dash-view-financial');
      var opsBtn = contentEl.querySelector('#dash-view-operations');
      if (finBtn) {
        finBtn.onclick = function() {
          ownerView = 'financial';
          renderDashboardData(contentEl, dash, role, onPeriodChange);
        };
      }
      if (opsBtn) {
        opsBtn.onclick = function() {
          ownerView = 'operations';
          renderDashboardData(contentEl, dash, role, onPeriodChange);
        };
      }
    }
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
