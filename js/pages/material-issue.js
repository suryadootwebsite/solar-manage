/**
 * material-issue.js — S09 Material Issue & Usage History Form.
 *
 * Implements Doc 03 F-15 & Doc 06 S08 / S15.
 */

window.pages = window.pages || {};

window.pages.materialIssue = function(container) {
  var t = window.i18n.t;
  var esc = window.ui.esc;

  container.innerHTML =
    '<div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">' +
      '<div>' +
        '<h2 style="margin:0;">' + esc(t('usage.title') || 'Material Issue') + '</h2>' +
        '<p class="text-muted" style="margin:0; font-size:0.85rem;">' + esc(t('usage.subtitle') || 'Issue materials and track site consumption') + '</p>' +
      '</div>' +
      '<button id="btn-new-issue" class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.85rem;">+ ' + esc(t('usage.new_issue') || 'New Issue') + '</button>' +
    '</div>' +

    '<div class="card" style="margin-bottom:1rem; padding:0.75rem;">' +
      '<div style="display:flex; gap:0.5rem; align-items:center;">' +
        '<label style="font-weight:600; font-size:0.85rem;">' + esc(t('usage.select_site') || 'Site:') + '</label>' +
        '<select id="issue-site-select" class="input" style="flex:1;">' +
          '<option value="">' + esc(t('common.loading') || 'Loading sites...') + '</option>' +
        '</select>' +
      '</div>' +
    '</div>' +

    '<div id="issue-history-section">' +
      '<div class="card">' +
        '<h3 style="margin-top:0; font-size:1rem;">' + esc(t('usage.history') || 'Site Usage History') + '</h3>' +
        '<div id="usage-list-container">' +
          '<p class="text-muted" style="font-size:0.85rem;">' + esc(t('usage.pick_site_hint') || 'Select a site above to view material consumption.') + '</p>' +
        '</div>' +
      '</div>' +
    '</div>';

  var siteSelect = document.getElementById('issue-site-select');
  var usageContainer = document.getElementById('usage-list-container');
  var btnNewIssue = document.getElementById('btn-new-issue');

  // Load sites
  window.api.call('sites.list', {})
    .then(function(res) {
      var sites = (res && res.items) ? res.items : (res && res.rows ? res.rows : (res && res.data && res.data.rows ? res.data.rows : []));
      if (!sites.length) {
        siteSelect.innerHTML = '<option value="">' + esc(t('usage.no_sites') || 'No sites found') + '</option>';
        return;
      }
      siteSelect.innerHTML = '<option value="">-- ' + esc(t('usage.choose_site') || 'Select Site') + ' --</option>' +
        sites.map(function(s) {
          return '<option value="' + esc(s.site_id) + '" data-loc="' + esc(s.default_location_id || '') + '">' + esc(s.site_name) + ' (' + esc(s.system_kw || '0') + 'kW)</option>';
        }).join('');
    })
    .catch(function(err) {
      siteSelect.innerHTML = '<option value="">' + esc(err.message) + '</option>';
    });

  siteSelect.addEventListener('change', function() {
    var siteId = siteSelect.value;
    if (!siteId) {
      usageContainer.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">' + esc(t('usage.pick_site_hint') || 'Select a site above.') + '</p>';
      return;
    }
    loadUsageHistory(siteId);
  });

  function loadUsageHistory(siteId) {
    usageContainer.innerHTML = '<p class="text-muted">' + esc(t('common.loading') || 'Loading...') + '</p>';
    window.api.call('usage.list', { site_id: siteId })
      .then(function(res) {
        var rows = (res && res.items) ? res.items : (res && res.rows ? res.rows : (res && res.data && res.data.rows ? res.data.rows : []));
        if (!rows.length) {
          usageContainer.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">' + esc(t('usage.no_records') || 'No material issued to this site yet.') + '</p>';
          return;
        }

        var isOwnerOrMgr = window.auth.can('usage.reverse');

        usageContainer.innerHTML =
          '<div style="overflow-x:auto;">' +
            '<table class="table" style="width:100%; font-size:0.85rem;">' +
              '<thead>' +
                '<tr>' +
                  '<th>' + esc(t('usage.date') || 'Date') + '</th>' +
                  '<th>' + esc(t('usage.product') || 'Product') + '</th>' +
                  '<th>' + esc(t('usage.type') || 'Type') + '</th>' +
                  '<th>' + esc(t('usage.qty') || 'Qty') + '</th>' +
                  '<th>' + esc(t('usage.serial') || 'Serial') + '</th>' +
                  (isOwnerOrMgr ? '<th>' + esc(t('common.actions') || 'Action') + '</th>' : '') +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                rows.map(function(r) {
                  var isReturn = r.type === 'RETURN';
                  var badge = isReturn
                    ? '<span class="badge" style="background:var(--warning-light, #fef3c7); color:var(--warning, #b45309);">RETURN</span>'
                    : '<span class="badge" style="background:var(--success-light, #d1fae5); color:var(--success, #065f46);">ISSUE</span>';
                  var actionBtn = (isOwnerOrMgr && !isReturn)
                    ? '<button class="btn btn-outline btn-reverse-item" data-id="' + esc(r.usage_id) + '" style="padding:0.2rem 0.5rem; font-size:0.75rem;">' + esc(t('usage.return') || 'Return') + '</button>'
                    : '';

                  return '<tr>' +
                    '<td>' + esc(r.used_on || '') + '</td>' +
                    '<td>' + esc(r.product_id || '') + '</td>' +
                    '<td>' + badge + '</td>' +
                    '<td>' + esc(r.qty || '') + '</td>' +
                    '<td>' + esc(r.serial_id || '-') + '</td>' +
                    (isOwnerOrMgr ? '<td>' + actionBtn + '</td>' : '') +
                  '</tr>';
                }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>';

        // Wire return button listeners
        usageContainer.querySelectorAll('.btn-reverse-item').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var uid = btn.getAttribute('data-id');
            showReturnModal(uid, siteId);
          });
        });
      })
      .catch(function(err) {
        usageContainer.innerHTML = '<p class="text-danger">' + esc(err.message) + '</p>';
      });
  }

  function showReturnModal(usageId, siteId) {
    var html =
      '<h3>' + esc(t('usage.return_modal_title') || 'Return Material') + '</h3>' +
      '<p class="text-muted" style="font-size:0.85rem;">' + esc(t('usage.return_notice') || 'This creates a signed RETURN row and restores batch stock.') + '</p>' +
      '<div class="form-field">' +
        '<label>' + esc(t('usage.return_reason') || 'Reason') + '</label>' +
        '<input id="ret-reason" class="input" placeholder="e.g. Excess material / Defective">' +
      '</div>' +
      '<div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">' +
        '<button id="btn-cancel-ret" class="btn btn-outline">' + esc(t('common.cancel') || 'Cancel') + '</button>' +
        '<button id="btn-confirm-ret" class="btn btn-primary">' + esc(t('common.confirm') || 'Confirm Return') + '</button>' +
      '</div>';

    window.ui.showBottomSheet(html);

    document.getElementById('btn-cancel-ret').addEventListener('click', window.ui.hideBottomSheet);
    document.getElementById('btn-confirm-ret').addEventListener('click', function() {
      var reason = document.getElementById('ret-reason').value.trim();
      if (!reason) {
        window.ui.toast(t('usage.reason_required') || 'Reason is required', 'error');
        return;
      }
      window.api.call('usage.reverse', { usage_id: usageId, reason: reason })
        .then(function() {
          window.ui.hideBottomSheet();
          window.ui.toast(t('usage.return_success') || 'Material returned successfully', 'success');
          loadUsageHistory(siteId);
        })
        .catch(function(err) {
          window.ui.toast(err.message, 'error');
        });
    });
  }

  btnNewIssue.addEventListener('click', function() {
    var siteId = siteSelect.value;
    if (!siteId) {
      window.ui.toast(t('usage.select_site_first') || 'Please select a site first', 'warning');
      return;
    }
    showNewIssueSheet(siteId);
  });

  function showNewIssueSheet(siteId) {
    var selectedOpt = siteSelect.options[siteSelect.selectedIndex];
    var locId = selectedOpt ? selectedOpt.getAttribute('data-loc') : '';

    var html =
      '<h3>' + esc(t('usage.issue_modal_title') || 'Issue Materials to Site') + '</h3>' +
      '<div class="form-field">' +
        '<label>' + esc(t('usage.product') || 'Product') + '</label>' +
        '<select id="issue-prod-select" class="input">' +
          '<option value="">' + esc(t('common.loading') || 'Loading...') + '</option>' +
        '</select>' +
      '</div>' +
      '<div id="issue-qty-field" class="form-field">' +
        '<label>' + esc(t('usage.qty') || 'Quantity') + '</label>' +
        '<input id="issue-qty-input" type="number" class="input" min="1" placeholder="Enter quantity">' +
      '</div>' +
      '<div id="issue-serial-field" class="form-field" style="display:none;">' +
        '<label>' + esc(t('usage.serial_nos') || 'Serial Numbers (comma-separated)') + '</label>' +
        '<textarea id="issue-serial-input" class="input" rows="3" placeholder="Paste or type serial numbers"></textarea>' +
      '</div>' +
      '<div class="form-field">' +
        '<label>' + esc(t('usage.date') || 'Used Date') + '</label>' +
        '<input id="issue-date-input" type="date" class="input" value="' + new Date().toISOString().slice(0, 10) + '">' +
      '</div>' +
      '<div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">' +
        '<button id="btn-cancel-issue" class="btn btn-outline">' + esc(t('common.cancel') || 'Cancel') + '</button>' +
        '<button id="btn-submit-issue" class="btn btn-primary">' + esc(t('usage.submit_issue') || 'Issue Materials') + '</button>' +
      '</div>';

    window.ui.showBottomSheet(html);

    var prodSelect = document.getElementById('issue-prod-select');
    var qtyField = document.getElementById('issue-qty-field');
    var serialField = document.getElementById('issue-serial-field');

    window.api.call('products.list', {})
      .then(function(res) {
        var prods = (res && res.items) ? res.items : (res && res.rows ? res.rows : (res && res.data && res.data.rows ? res.data.rows : []));
        prodSelect.innerHTML = '<option value="">-- ' + esc(t('usage.select_product') || 'Select Product') + ' --</option>' +
          prods.map(function(p) {
            return '<option value="' + esc(p.product_id) + '" data-serial="' + (p.track_serial ? '1' : '0') + '">' + esc(p.name) + '</option>';
          }).join('');
      });

    prodSelect.addEventListener('change', function() {
      var opt = prodSelect.options[prodSelect.selectedIndex];
      var isSerial = opt && opt.getAttribute('data-serial') === '1';
      if (isSerial) {
        qtyField.style.display = 'none';
        serialField.style.display = '';
      } else {
        qtyField.style.display = '';
        serialField.style.display = 'none';
      }
    });

    document.getElementById('btn-cancel-issue').addEventListener('click', window.ui.hideBottomSheet);
    document.getElementById('btn-submit-issue').addEventListener('click', function() {
      var prodId = prodSelect.value;
      if (!prodId) {
        window.ui.toast('Please select a product', 'error');
        return;
      }
      var opt = prodSelect.options[prodSelect.selectedIndex];
      var isSerial = opt && opt.getAttribute('data-serial') === '1';

      var line = { product_id: prodId };
      if (isSerial) {
        var rawSerials = document.getElementById('issue-serial-input').value;
        var snList = rawSerials.split(/[,\n]+/).map(function(s) { return s.trim(); }).filter(Boolean);
        if (!snList.length) {
          window.ui.toast('Please enter at least one serial number', 'error');
          return;
        }
        line.serial_nos = snList;
      } else {
        var qty = Number(document.getElementById('issue-qty-input').value);
        if (!qty || qty <= 0) {
          window.ui.toast('Please enter a valid quantity', 'error');
          return;
        }
        line.qty = qty;
      }

      var payload = {
        site_id: siteId,
        location_id: locId,
        used_on: document.getElementById('issue-date-input').value,
        lines: [line]
      };

      window.api.call('usage.issue', payload)
        .then(function() {
          window.ui.hideBottomSheet();
          window.ui.toast(t('usage.issue_success') || 'Materials issued successfully', 'success');
          loadUsageHistory(siteId);
        })
        .catch(function(err) {
          window.ui.toast(err.message, 'error');
        });
    });
  }
};
