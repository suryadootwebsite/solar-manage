/**
 * serial-register.js — S09 Serial Register & Replacement.
 *
 * Implements Doc 03 F-17 & Doc 05 §13.
 */

window.pages = window.pages || {};

window.pages.serialRegister = function(container) {
  var t = window.i18n.t;
  var esc = window.ui.esc;

  container.innerHTML =
    '<div class="page-header" style="margin-bottom:1rem;">' +
      '<h2 style="margin:0;">' + esc(t('serials.title') || 'Serial Register') + '</h2>' +
      '<p class="text-muted" style="margin:0; font-size:0.85rem;">' + esc(t('serials.subtitle') || 'Search serial numbers, manage warranties & replacements') + '</p>' +
    '</div>' +

    '<div class="card" style="margin-bottom:1rem; padding:0.75rem;">' +
      '<div style="display:flex; gap:0.5rem;">' +
        '<input id="serial-search-input" class="input" placeholder="' + esc(t('serials.search_placeholder') || 'Search serial number...') + '" style="flex:1;">' +
        '<button id="btn-serial-search" class="btn btn-primary" style="padding:0.4rem 0.8rem;">' + esc(t('common.search') || 'Search') + '</button>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div id="serials-table-container">' +
        '<p class="text-muted" style="font-size:0.85rem;">' + esc(t('serials.search_hint') || 'Type a serial number above or click Search to browse.') + '</p>' +
      '</div>' +
    '</div>';

  var searchInput = document.getElementById('serial-search-input');
  var btnSearch = document.getElementById('btn-serial-search');
  var tableContainer = document.getElementById('serials-table-container');

  btnSearch.addEventListener('click', function() {
    window.ui.withButtonLoading(btnSearch, performSearch);
  });
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      window.ui.withButtonLoading(btnSearch, performSearch);
    }
  });

  function performSearch() {
    var q = searchInput.value.trim();
    tableContainer.innerHTML = '<p class="text-muted">' + esc(t('common.loading') || 'Loading...') + '</p>';

    var action = q ? 'serials.search' : 'serials.list';
    var payload = q ? { q: q } : {};

    return window.api.call(action, payload)
      .then(function(res) {
        var rows = (res && res.items) ? res.items : (res && res.rows ? res.rows : (res && res.data && res.data.rows ? res.data.rows : []));
        if (!rows.length) {
          tableContainer.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">' + esc(t('serials.no_results') || 'No serial numbers found.') + '</p>';
          return;
        }

        var isOwnerOrMgr = window.auth.can('serials.replace');

        tableContainer.innerHTML =
          '<div style="overflow-x:auto;">' +
            '<table class="table" style="width:100%; font-size:0.85rem;">' +
              '<thead>' +
                '<tr>' +
                  '<th>' + esc(t('serials.serial_no') || 'Serial No') + '</th>' +
                  '<th>' + esc(t('serials.status') || 'Status') + '</th>' +
                  '<th>' + esc(t('serials.site') || 'Site') + '</th>' +
                  '<th>' + esc(t('serials.warranty_end') || 'Warranty Until') + '</th>' +
                  (isOwnerOrMgr ? '<th>' + esc(t('common.actions') || 'Action') + '</th>' : '') +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                rows.map(function(s) {
                  var badgeColor = 'var(--text-muted)';
                  if (s.status === 'IN_STOCK') badgeColor = 'var(--success, #065f46)';
                  if (s.status === 'ISSUED')   badgeColor = 'var(--brand, #2563eb)';
                  if (s.status === 'DEFECTIVE'|| s.status === 'REPLACED') badgeColor = 'var(--danger, #dc2626)';

                  var badge = '<span class="badge" style="color:' + badgeColor + '; border:1px solid ' + badgeColor + ';">' + esc(s.status) + '</span>';

                  var actionBtn = '';
                  if (isOwnerOrMgr && s.status === 'ISSUED') {
                    actionBtn = '<button class="btn btn-outline btn-replace-serial" data-id="' + esc(s.serial_id) + '" data-prod="' + esc(s.product_id) + '" data-site="' + esc(s.site_id || '') + '" style="padding:0.2rem 0.5rem; font-size:0.75rem;">' + esc(t('serials.replace') || 'Replace') + '</button>';
                  }

                  return '<tr>' +
                    '<td style="font-family:monospace; font-weight:600;">' + esc(s.serial_no) + '</td>' +
                    '<td>' + badge + '</td>' +
                    '<td>' + esc(s.site_id || '-') + '</td>' +
                    '<td>' + esc(s.warranty_end || 'Not Started') + '</td>' +
                    (isOwnerOrMgr ? '<td>' + actionBtn + '</td>' : '') +
                  '</tr>';
                }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>';

        tableContainer.querySelectorAll('.btn-replace-serial').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var oldId = btn.getAttribute('data-id');
            var prodId = btn.getAttribute('data-prod');
            var siteId = btn.getAttribute('data-site');
            showReplaceModal(oldId, prodId, siteId);
          });
        });
      })
      .catch(function(err) {
        tableContainer.innerHTML = '<p class="text-danger">' + esc(err.message) + '</p>';
      });
  }

  function showReplaceModal(oldSerialId, productId, siteId) {
    var html =
      '<h3>' + esc(t('serials.replace_modal_title') || 'Replace Installed Serial') + '</h3>' +
      '<p class="text-muted" style="font-size:0.85rem;">' + esc(t('serials.replace_notice') || 'Marks old serial as REPLACED and issues a new IN_STOCK unit to the site.') + '</p>' +
      '<div class="form-field">' +
        '<label>' + esc(t('serials.select_replacement') || 'Select New Replacement Serial') + '</label>' +
        '<select id="repl-new-serial-select" class="input">' +
          '<option value="">' + esc(t('common.loading') || 'Loading available serials...') + '</option>' +
        '</select>' +
      '</div>' +
      '<div class="form-field">' +
        '<label>' + esc(t('serials.reason') || 'Fault Reason') + '</label>' +
        '<input id="repl-reason-input" class="input" placeholder="e.g. Inverter error / Cracked glass">' +
      '</div>' +
      '<div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">' +
        '<button id="btn-cancel-repl" class="btn btn-outline">' + esc(t('common.cancel') || 'Cancel') + '</button>' +
        '<button id="btn-confirm-repl" class="btn btn-primary">' + esc(t('serials.confirm_replace') || 'Confirm Replacement') + '</button>' +
      '</div>';

    window.ui.showBottomSheet(html);

    var sel = document.getElementById('repl-new-serial-select');
    window.api.call('serials.available', { product_id: productId, site_id: siteId })
      .then(function(res) {
        var avail = (res && res.items) ? res.items : (res && res.rows ? res.rows : (res && res.data && res.data.rows ? res.data.rows : []));
        if (!avail.length) {
          sel.innerHTML = '<option value="">' + esc(t('serials.no_avail') || 'No IN_STOCK serials available') + '</option>';
          return;
        }
        sel.innerHTML = '<option value="">-- ' + esc(t('serials.choose_new') || 'Select Serial') + ' --</option>' +
          avail.map(function(s) {
            return '<option value="' + esc(s.serial_id) + '">' + esc(s.serial_no) + '</option>';
          }).join('');
      });

    document.getElementById('btn-cancel-repl').addEventListener('click', window.ui.hideBottomSheet);
    var replBtn = document.getElementById('btn-confirm-repl');
    replBtn.addEventListener('click', function() {
      var newId = sel.value;
      var reason = document.getElementById('repl-reason-input').value.trim();
      if (!newId) {
        window.ui.toast('Please select a replacement serial', 'error');
        return;
      }
      if (!reason) {
        window.ui.toast('Please provide a fault reason', 'error');
        return;
      }

      window.ui.withButtonLoading(replBtn, async function() {
        try {
          var res = await window.api.call('serials.replace', {
            old_serial_id: oldSerialId,
            new_serial_id: newId,
            reason: reason
          });
          window.ui.hideBottomSheet();
          var warningMsg = (res && res.warning) || (res && res.data && res.data.warning);
          if (warningMsg) {
            window.ui.toast(warningMsg, 'warning');
          } else {
            window.ui.toast(t('serials.replace_success') || 'Serial replaced successfully', 'success');
          }
          performSearch();
        } catch(err) {
          window.ui.toast(err.message, 'error');
        }
      });
    });
  }

  // Initial load
  performSearch();
};
