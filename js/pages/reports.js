/**
 * js/pages/reports.js — 12 Standard Reports & CSV Export Page.
 *
 * Enforces:
 *   - Doc 03 F-28: 12 standard reports with filter controls & CSV download.
 *   - Doc 02 §8: Zero financial columns for MANAGER.
 *   - Client-side CSV generation & Blob download.
 *   - Mobile responsive table with 48px touch controls.
 */

(function() {
  window.pages = window.pages || {};

  function render(container) {
    var t = window.i18n.t;
    var ui = window.ui;
    var api = window.api;
    var currentData = null;

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-title">' + ui.esc(t('rep.title')) + '</h1>' +
          '<p class="page-subtitle">' + ui.esc(t('rep.subtitle')) + '</p>' +
        '</div>' +
        '<div class="page-actions">' +
          '<button id="rep-export-btn" class="btn btn-secondary" style="min-height:48px;display:inline-flex;align-items:center;" disabled>' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' +
            ui.esc(t('rep.export_csv')) +
          '</button>' +
        '</div>' +
      '</div>' +

      '<div class="card" style="margin-bottom:1.5rem;">' +
        '<div class="form-row" style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;">' +
          '<div class="form-field" style="flex:1;min-width:240px;margin-bottom:0;">' +
            '<label for="rep-select" style="font-weight:600;margin-bottom:6px;display:block;">' + ui.esc(t('rep.select_report')) + '</label>' +
            '<select id="rep-select" class="input" style="min-height:48px;">' +
              '<option value="">-- Choose Report --</option>' +
            '</select>' +
          '</div>' +
          '<div style="margin-bottom:0;">' +
            '<button id="rep-run-btn" class="btn btn-primary" style="min-height:48px;padding:0 1.5rem;" disabled>' +
              ui.esc(t('rep.run')) +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div id="rep-results-container">' +
        '<div class="card" style="text-align:center;padding:2.5rem;">' +
          '<p class="text-muted">' + ui.esc(t('rep.select_report')) + '</p>' +
        '</div>' +
      '</div>';

    var selectEl = container.querySelector('#rep-select');
    var runBtn = container.querySelector('#rep-run-btn');
    var exportBtn = container.querySelector('#rep-export-btn');
    var resultsEl = container.querySelector('#rep-results-container');

    // Load available reports catalogue
    api.call('reports.list', {})
      .then(function(reports) {
        var opts = '<option value="">-- Choose Report --</option>';
        (reports || []).forEach(function(r) {
          opts += '<option value="' + ui.esc(r.id) + '">' + ui.esc(r.name_en) + (r.owner_only ? ' (Owner Only)' : '') + '</option>';
        });
        selectEl.innerHTML = opts;
      })
      .catch(function(err) {
        ui.toast(err.message || 'Error listing reports', 'error');
      });

    selectEl.addEventListener('change', function() {
      var hasVal = Boolean(selectEl.value);
      runBtn.disabled = !hasVal;
    });

    runBtn.addEventListener('click', function() {
      var repId = selectEl.value;
      if (!repId) return;

      resultsEl.innerHTML =
        '<div class="card" style="text-align:center;padding:2.5rem;">' +
          '<div class="spinner" style="margin:0 auto 1rem;"></div>' +
          '<p class="text-muted">' + ui.esc(t('rep.loading')) + '</p>' +
        '</div>';
      exportBtn.disabled = true;

      api.call('reports.run', { report_id: repId })
        .then(function(res) {
          currentData = res;
          renderReportResults(resultsEl, res);
          exportBtn.disabled = !(res.rows && res.rows.length > 0);
        })
        .catch(function(err) {
          currentData = null;
          resultsEl.innerHTML =
            '<div class="card card-error" style="padding:1.5rem;">' +
              '<h3>' + ui.esc(t('ping.failed')) + '</h3>' +
              '<p class="text-muted">' + ui.esc(err.message || 'Error running report') + '</p>' +
            '</div>';
          exportBtn.disabled = true;
        });
    });

    exportBtn.addEventListener('click', function() {
      if (!currentData || !currentData.rows || !currentData.rows.length) return;
      downloadCsv(currentData);
    });
  }

  function renderReportResults(container, data) {
    var t = window.i18n.t;
    var ui = window.ui;

    if (!data.rows || data.rows.length === 0) {
      container.innerHTML =
        '<div class="card" style="text-align:center;padding:2rem;">' +
          '<p class="text-muted">' + ui.esc(t('rep.no_data')) + '</p>' +
        '</div>';
      return;
    }

    var countText = t('rep.rows_count').replace('{count}', data.rows.length);

    var html =
      '<div class="card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">' +
          '<h3 style="margin:0;font-size:1.1rem;">' + ui.esc(data.name || data.report_id) + '</h3>' +
          '<span class="badge">' + ui.esc(countText) + '</span>' +
        '</div>' +
        '<div class="table-responsive">' +
          '<table class="data-table">' +
            '<thead>' +
              '<tr>' +
                data.headers.map(function(h) {
                  return '<th>' + ui.esc(formatHeader(h)) + '</th>';
                }).join('') +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              data.rows.map(function(row) {
                return '<tr>' +
                  data.headers.map(function(h) {
                    return '<td>' + formatCellValue(h, row[h]) + '</td>';
                  }).join('') +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

    container.innerHTML = html;
  }

  function formatHeader(header) {
    return header
      .replace(/_paise$/, ' (₹)')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, function(l) { return l.toUpperCase(); });
  }

  function formatCellValue(key, val) {
    if (val === null || val === undefined || val === '') return '-';
    if (key.endsWith('_paise')) {
      var r = Math.round(Number(val) / 100);
      return '₹' + r.toLocaleString('en-IN');
    }
    return window.ui.esc(String(val));
  }

  function downloadCsv(data) {
    var headers = data.headers;
    var rows = data.rows;
    var lines = [];

    lines.push(headers.map(function(h) { return '"' + String(h).replace(/"/g, '""') + '"'; }).join(','));

    rows.forEach(function(row) {
      var rowVals = headers.map(function(h) {
        var v = row[h];
        if (v === null || v === undefined) v = '';
        if (h.endsWith('_paise') && v !== '') {
          v = (Math.round(Number(v) / 100)).toString();
        }
        return '"' + String(v).replace(/"/g, '""') + '"';
      });
      lines.push(rowVals.join(','));
    });

    var csvContent = lines.join('\r\n');
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (data.report_id || 'report') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  window.pages.reports = render;
})();
