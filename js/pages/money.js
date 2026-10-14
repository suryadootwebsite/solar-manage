/**
 * money.js — S10 Owner Financial Management Page (Doc 06 S18).
 *
 * Implements:
 *   - Customer Payments (cpay)
 *   - Subsidy Tracking
 *   - Supplier Payments (spay) & Ledger
 *   - Site Expenses (exp)
 *   - Site P&L (sites.pnl)
 */

window.pages = window.pages || {};

window.pages.money = function(container) {
  var t = window.i18n.t;
  var esc = window.ui.esc;

  container.innerHTML =
    '<div class="page-header" style="margin-bottom:1rem;">' +
      '<h2 style="margin:0;">' + esc(t('money.title') || 'Financial Management') + '</h2>' +
      '<p class="text-muted" style="margin:0; font-size:0.85rem;">' + esc(t('money.subtitle') || 'Customer payments, expenses, supplier ledger & site profitability') + '</p>' +
    '</div>' +

    '<div style="display:flex; gap:0.5rem; margin-bottom:1rem; overflow-x:auto;">' +
      '<button id="tab-cpay" class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.85rem;">' + esc(t('money.tab_cpay') || 'Customer Payments & P&L') + '</button>' +
      '<button id="tab-spay" class="btn btn-outline" style="padding:0.4rem 0.8rem; font-size:0.85rem;">' + esc(t('money.tab_spay') || 'Supplier Payments') + '</button>' +
      '<button id="tab-exp" class="btn btn-outline" style="padding:0.4rem 0.8rem; font-size:0.85rem;">' + esc(t('money.tab_exp') || 'Site Expenses') + '</button>' +
    '</div>' +

    '<div id="money-content-area"></div>';

  var tabCpay = document.getElementById('tab-cpay');
  var tabSpay = document.getElementById('tab-spay');
  var tabExp = document.getElementById('tab-exp');
  var contentArea = document.getElementById('money-content-area');

  function setTab(activeBtn) {
    [tabCpay, tabSpay, tabExp].forEach(function(btn) {
      if (btn === activeBtn) {
        btn.className = 'btn btn-primary';
      } else {
        btn.className = 'btn btn-outline';
      }
    });
  }

  tabCpay.addEventListener('click', function() { setTab(tabCpay); renderCpayView(); });
  tabSpay.addEventListener('click', function() { setTab(tabSpay); renderSpayView(); });
  tabExp.addEventListener('click', function() { setTab(tabExp); renderExpView(); });

  // Default view: Customer Payments & P&L
  renderCpayView();

  // -------------------------------------------------------------------------
  // Customer Payments & P&L View
  // -------------------------------------------------------------------------
  function renderCpayView() {
    contentArea.innerHTML =
      '<div class="card" style="margin-bottom:1rem; padding:0.75rem;">' +
        '<div style="display:flex; gap:0.5rem; align-items:center;">' +
          '<label style="font-weight:600; font-size:0.85rem;">' + esc(t('money.select_site') || 'Select Site:') + '</label>' +
          '<select id="money-site-select" class="input" style="flex:1;">' +
            '<option value="">' + esc(t('common.loading') || 'Loading sites...') + '</option>' +
          '</select>' +
          '<button id="btn-add-cpay" class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.85rem;">+ ' + esc(t('money.add_payment') || 'Add Payment') + '</button>' +
        '</div>' +
      '</div>' +

      '<div id="site-pnl-card" style="margin-bottom:1rem;"></div>' +

      '<div class="card">' +
        '<h3 style="margin-top:0; font-size:1rem;">' + esc(t('money.payment_history') || 'Payments Received') + '</h3>' +
        '<div id="cpay-table-container">' +
          '<p class="text-muted" style="font-size:0.85rem;">' + esc(t('money.pick_site_hint') || 'Select a site to view payments and profitability.') + '</p>' +
        '</div>' +
      '</div>';

    var siteSel = document.getElementById('money-site-select');
    var btnAddCpay = document.getElementById('btn-add-cpay');
    var pnlContainer = document.getElementById('site-pnl-card');
    var tableContainer = document.getElementById('cpay-table-container');

    window.api.call('sites.list', {})
      .then(function(res) {
        var sites = (res && res.items) ? res.items : (res && res.rows ? res.rows : (res && res.data && res.data.rows ? res.data.rows : []));
        if (!sites.length) {
          siteSel.innerHTML = '<option value="">' + esc(t('money.no_sites') || 'No sites found') + '</option>';
          return;
        }
        siteSel.innerHTML = '<option value="">-- ' + esc(t('money.choose_site') || 'Choose Site') + ' --</option>' +
          sites.map(function(s) {
            return '<option value="' + esc(s.site_id) + '">' + esc(s.site_name) + ' (' + esc(s.system_kw || '0') + 'kW)</option>';
          }).join('');
      });

    siteSel.addEventListener('change', function() {
      var siteId = siteSel.value;
      if (!siteId) {
        pnlContainer.innerHTML = '';
        tableContainer.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">' + esc(t('money.pick_site_hint') || 'Select a site.') + '</p>';
        return;
      }
      loadSitePnl(siteId);
      loadCpayList(siteId);
    });

    btnAddCpay.addEventListener('click', function() {
      var siteId = siteSel.value;
      if (!siteId) {
        window.ui.toast(t('money.select_site_first') || 'Select a site first', 'warning');
        return;
      }
      showAddCpaySheet(siteId);
    });

    function loadSitePnl(siteId) {
      window.api.call('sites.pnl', { site_id: siteId })
        .then(function(res) {
          var pnl = (res && res.data) ? res.data : (res || {});
          var marginPct = Number(pnl.profit_margin_pct) || 0;
          var marginColor = marginPct >= 15 ? 'var(--success, #065f46)' : 'var(--warning, #b45309)';

          pnlContainer.innerHTML =
            '<div class="card" style="background:var(--surface, #fff); border-left:4px solid var(--brand);">' +
              '<h3 style="margin-top:0; font-size:1rem; display:flex; justify-content:space-between;">' +
                '<span>' + esc(t('money.site_pnl') || 'Site Profit & Loss') + '</span>' +
                '<span style="color:' + marginColor + '; font-weight:700;">' + marginPct + '% Margin</span>' +
              '</h3>' +
              '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.75rem; font-size:0.85rem;">' +
                '<div><span class="text-muted">Contract Value:</span><br><strong>₹' + ((Number(pnl.contract_value_paise) || 0) / 100).toLocaleString('en-IN') + '</strong></div>' +
                '<div><span class="text-muted">Material Cost:</span><br><strong>₹' + ((Number(pnl.material_cost_paise) || 0) / 100).toLocaleString('en-IN') + '</strong></div>' +
                '<div><span class="text-muted">Expenses:</span><br><strong>₹' + ((Number(pnl.expenses_paise) || 0) / 100).toLocaleString('en-IN') + '</strong></div>' +
                '<div><span class="text-muted">Gross Profit:</span><br><strong style="color:' + marginColor + ';">₹' + ((Number(pnl.gross_profit_paise) || 0) / 100).toLocaleString('en-IN') + '</strong></div>' +
                '<div><span class="text-muted">Received:</span><br><strong>₹' + ((Number(pnl.received_paise) || 0) / 100).toLocaleString('en-IN') + '</strong></div>' +
                '<div><span class="text-muted">Balance Due:</span><br><strong style="color:var(--danger, #dc2626);">₹' + ((Number(pnl.balance_due_paise) || 0) / 100).toLocaleString('en-IN') + '</strong></div>' +
              '</div>' +
            '</div>';
        })
        .catch(function(err) {
          pnlContainer.innerHTML = '<p class="text-danger">' + esc(err.message) + '</p>';
        });
    }

    function loadCpayList(siteId) {
      window.api.call('cpay.list', { site_id: siteId })
        .then(function(res) {
          var rows = (res && res.rows) ? res.rows : (res && res.items ? res.items : (res && res.data && res.data.rows ? res.data.rows : []));
          if (!rows.length) {
            tableContainer.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">' + esc(t('money.no_payments') || 'No payments recorded for this site.') + '</p>';
            return;
          }

          tableContainer.innerHTML =
            '<div style="overflow-x:auto;">' +
              '<table class="table" style="width:100%; font-size:0.85rem;">' +
                '<thead>' +
                  '<tr>' +
                    '<th>' + esc(t('money.date') || 'Date') + '</th>' +
                    '<th>' + esc(t('money.type') || 'Type') + '</th>' +
                    '<th>' + esc(t('money.mode') || 'Mode') + '</th>' +
                    '<th>' + esc(t('money.amount') || 'Amount') + '</th>' +
                    '<th>' + esc(t('money.status') || 'Status') + '</th>' +
                    '<th>' + esc(t('common.actions') || 'Action') + '</th>' +
                  '</tr>' +
                '</thead>' +
                '<tbody>' +
                  rows.map(function(p) {
                    var isRev = p.status === 'REVERSED';
                    var amtFormatted = '₹' + (Math.abs(p.amount_paise) / 100).toLocaleString('en-IN');
                    var amtDisplay = p.amount_paise < 0 ? ('-' + amtFormatted) : amtFormatted;

                    return '<tr>' +
                      '<td>' + esc(p.pay_date || '') + '</td>' +
                      '<td>' + esc(p.type) + '</td>' +
                      '<td>' + esc(p.mode) + '</td>' +
                      '<td style="font-weight:600;">' + amtDisplay + '</td>' +
                      '<td><span class="badge" style="' + (isRev ? 'color:var(--danger);' : 'color:var(--success);') + '">' + esc(p.status) + '</span></td>' +
                      '<td>' + (!isRev ? '<button class="btn btn-outline btn-rev-cpay" data-id="' + esc(p.cpay_id) + '" style="padding:0.2rem 0.5rem; font-size:0.75rem;">' + esc(t('money.reverse') || 'Reverse') + '</button>' : '') + '</td>' +
                    '</tr>';
                  }).join('') +
                '</tbody>' +
              '</table>' +
            '</div>';

          tableContainer.querySelectorAll('.btn-rev-cpay').forEach(function(btn) {
            btn.addEventListener('click', function() {
              var cpayId = btn.getAttribute('data-id');
              window.ui.showConfirm(t('money.confirm_cpay_reverse') || 'Reverse this payment entry?', function() {
                window.ui.withButtonLoading(btn, async function() {
                  try {
                    await window.api.call('cpay.reverse', { cpay_id: cpayId, reason: 'Reversed by owner' });
                    window.ui.toast(t('money.reverse_success') || 'Payment reversed', 'success');
                    loadSitePnl(siteId);
                    loadCpayList(siteId);
                  } catch(err) {
                    window.ui.toast(err.message, 'error');
                  }
                });
              });
            });
          });
        });
    }

    function showAddCpaySheet(siteId) {
      var html =
        '<h3>' + esc(t('money.add_cpay_title') || 'Record Customer Payment') + '</h3>' +
        '<div class="form-field">' +
          '<label>' + esc(t('money.amount_inr') || 'Amount (₹)') + '</label>' +
          '<input id="cpay-amt-input" type="number" class="input" placeholder="e.g. 50000" min="1">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + esc(t('money.type') || 'Type') + '</label>' +
          '<select id="cpay-type-select" class="input">' +
            '<option value="ADVANCE">ADVANCE</option>' +
            '<option value="INSTALLMENT" selected>INSTALLMENT</option>' +
            '<option value="FINAL">FINAL</option>' +
            '<option value="OTHER">OTHER</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + esc(t('money.mode') || 'Payment Mode') + '</label>' +
          '<select id="cpay-mode-select" class="input">' +
            '<option value="UPI">UPI</option>' +
            '<option value="BANK" selected>BANK (NEFT/RTGS/IMPS)</option>' +
            '<option value="CHEQUE">CHEQUE</option>' +
            '<option value="CASH">CASH</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + esc(t('money.ref_no') || 'Reference / Transaction No') + '</label>' +
          '<input id="cpay-ref-input" class="input" placeholder="e.g. UTR / Cheque No">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + esc(t('money.pay_date') || 'Payment Date') + '</label>' +
          '<input id="cpay-date-input" type="date" class="input" value="' + new Date().toISOString().slice(0, 10) + '">' +
        '</div>' +
        '<div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">' +
          '<button id="btn-cancel-cpay" class="btn btn-outline">' + esc(t('common.cancel') || 'Cancel') + '</button>' +
          '<button id="btn-submit-cpay" class="btn btn-primary">' + esc(t('money.save_payment') || 'Save Payment') + '</button>' +
        '</div>';

      window.ui.showBottomSheet(html);

      document.getElementById('btn-cancel-cpay').addEventListener('click', window.ui.hideBottomSheet);
      var submitCpayBtn = document.getElementById('btn-submit-cpay');
      submitCpayBtn.addEventListener('click', function() {
        var inr = Number(document.getElementById('cpay-amt-input').value);
        if (!inr || inr <= 0) {
          window.ui.toast('Please enter a valid amount', 'error');
          return;
        }

        var payload = {
          site_id: siteId,
          amount_paise: Math.round(inr * 100),
          type: document.getElementById('cpay-type-select').value,
          mode: document.getElementById('cpay-mode-select').value,
          ref_no: document.getElementById('cpay-ref-input').value.trim(),
          pay_date: document.getElementById('cpay-date-input').value
        };

        window.ui.withButtonLoading(submitCpayBtn, async function() {
          try {
            await window.api.call('cpay.add', payload);
            window.ui.hideBottomSheet();
            window.ui.toast(t('money.payment_saved') || 'Payment recorded successfully', 'success');
            loadSitePnl(siteId);
            loadCpayList(siteId);
          } catch(err) {
            window.ui.toast(err.message, 'error');
          }
        });
      });
    }
  }

  // -------------------------------------------------------------------------
  // Supplier Payments View
  // -------------------------------------------------------------------------
  function renderSpayView() {
    contentArea.innerHTML =
      '<div class="card" style="margin-bottom:1rem; padding:0.75rem;">' +
        '<div style="display:flex; gap:0.5rem; align-items:center;">' +
          '<label style="font-weight:600; font-size:0.85rem;">' + esc(t('money.select_supplier') || 'Supplier:') + '</label>' +
          '<select id="money-sup-select" class="input" style="flex:1;">' +
            '<option value="">' + esc(t('common.loading') || 'Loading suppliers...') + '</option>' +
          '</select>' +
          '<button id="btn-add-spay" class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.85rem;">+ ' + esc(t('money.add_spay') || 'Pay Supplier') + '</button>' +
        '</div>' +
      '</div>' +

      '<div id="spay-ledger-area"></div>';

    var supSel = document.getElementById('money-sup-select');
    var ledgerArea = document.getElementById('spay-ledger-area');
    var btnAddSpay = document.getElementById('btn-add-spay');

    window.api.call('suppliers.list', {})
      .then(function(res) {
        var sups = (res && res.items) ? res.items : (res && res.rows ? res.rows : (res && res.data && res.data.rows ? res.data.rows : []));
        supSel.innerHTML = '<option value="">-- ' + esc(t('money.choose_supplier') || 'Choose Supplier') + ' --</option>' +
          sups.map(function(s) {
            return '<option value="' + esc(s.supplier_id) + '">' + esc(s.name) + ' (' + esc(s.supplier_id) + ')</option>';
          }).join('');
      });

    supSel.addEventListener('change', function() {
      var supId = supSel.value;
      if (!supId) {
        ledgerArea.innerHTML = '';
        return;
      }
      loadSpayLedger(supId);
    });

    btnAddSpay.addEventListener('click', function() {
      var supId = supSel.value;
      if (!supId) {
        window.ui.toast('Select a supplier first', 'warning');
        return;
      }
      showAddSpaySheet(supId);
    });

    function loadSpayLedger(supId) {
      window.api.call('spay.ledger', { supplier_id: supId })
        .then(function(res) {
          var d = (res && res.data) ? res.data : res;
          var supplierNameDisplay = d.supplier_name ? `<strong>${esc(d.supplier_name)}</strong> <span style="font-size:0.8rem; color:var(--text-muted);">(${esc(supId)})</span>` : esc(supId);

          ledgerArea.innerHTML =
            '<div class="card" style="margin-bottom:1rem;">' +
              '<h3 style="margin-top:0; font-size:1rem;">' + esc(t('money.supplier_balance') || 'Supplier Ledger') + ': ' + supplierNameDisplay + '</h3>' +
              '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.75rem; font-size:0.85rem;">' +
                '<div><span class="text-muted">Total Purchased:</span><br><strong>₹' + (d.total_purchased_paise / 100).toLocaleString('en-IN') + '</strong></div>' +
                '<div><span class="text-muted">Total Paid:</span><br><strong style="color:var(--success);">₹' + (d.total_paid_paise / 100).toLocaleString('en-IN') + '</strong></div>' +
                '<div><span class="text-muted">Balance Due:</span><br><strong style="color:var(--danger);">₹' + (d.balance_pending_paise / 100).toLocaleString('en-IN') + '</strong></div>' +
              '</div>' +
            '</div>' +

            '<div class="card">' +
              '<h3 style="margin-top:0; font-size:1rem;">' + esc(t('money.lot_breakdown') || 'Purchase Lots') + '</h3>' +
              (!d.lots || !d.lots.length ? '<p class="text-muted" style="font-size:0.85rem;">No purchase lots for this supplier.</p>' :
                '<div style="overflow-x:auto;">' +
                  '<table class="table" style="width:100%; font-size:0.85rem;">' +
                    '<thead><tr><th>Lot ID</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Pending</th></tr></thead>' +
                    '<tbody>' +
                      d.lots.map(function(l) {
                        return '<tr>' +
                          '<td>' + esc(l.lot_id) + '</td>' +
                          '<td>' + esc(l.invoice_no) + '</td>' +
                          '<td>₹' + (l.grand_total_paise / 100).toLocaleString('en-IN') + '</td>' +
                          '<td>₹' + (l.paid_paise / 100).toLocaleString('en-IN') + '</td>' +
                          '<td style="color:' + (l.pending_paise > 0 ? 'var(--danger);' : 'var(--success);') + ' font-weight:600;">₹' + (l.pending_paise / 100).toLocaleString('en-IN') + '</td>' +
                        '</tr>';
                      }).join('') +
                    '</tbody>' +
                  '</table>' +
                '</div>'
              ) +
            '</div>';
        });
    }

    function showAddSpaySheet(supId) {
      var html =
        '<h3>' + esc(t('money.add_spay_title') || 'Record Supplier Payment') + '</h3>' +
        '<div class="form-field">' +
          '<label>' + esc(t('money.amount_inr') || 'Amount (₹)') + '</label>' +
          '<input id="spay-amt-input" type="number" class="input" placeholder="e.g. 100000" min="1">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + esc(t('money.mode') || 'Payment Mode') + '</label>' +
          '<select id="spay-mode-select" class="input">' +
            '<option value="BANK" selected>BANK (NEFT/RTGS)</option>' +
            '<option value="CHEQUE">CHEQUE</option>' +
            '<option value="UPI">UPI</option>' +
            '<option value="CASH">CASH</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + esc(t('money.ref_no') || 'Reference No') + '</label>' +
          '<input id="spay-ref-input" class="input" placeholder="UTR or Cheque No">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + esc(t('money.pay_date') || 'Payment Date') + '</label>' +
          '<input id="spay-date-input" type="date" class="input" value="' + new Date().toISOString().slice(0, 10) + '">' +
        '</div>' +
        '<div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">' +
          '<button id="btn-cancel-spay" class="btn btn-outline">' + esc(t('common.cancel') || 'Cancel') + '</button>' +
          '<button id="btn-submit-spay" class="btn btn-primary">' + esc(t('money.save_payment') || 'Record Payment') + '</button>' +
        '</div>';

      window.ui.showBottomSheet(html);
      document.getElementById('btn-cancel-spay').addEventListener('click', window.ui.hideBottomSheet);
      var submitSpayBtn = document.getElementById('btn-submit-spay');
      submitSpayBtn.addEventListener('click', function() {
        var inr = Number(document.getElementById('spay-amt-input').value);
        if (!inr || inr <= 0) {
          window.ui.toast('Enter valid amount', 'error');
          return;
        }
        var payload = {
          supplier_id: supId,
          amount_paise: Math.round(inr * 100),
          mode: document.getElementById('spay-mode-select').value,
          ref_no: document.getElementById('spay-ref-input').value.trim(),
          pay_date: document.getElementById('spay-date-input').value
        };

        window.ui.withButtonLoading(submitSpayBtn, async function() {
          try {
            await window.api.call('spay.add', payload);
            window.ui.hideBottomSheet();
            window.ui.toast('Supplier payment recorded', 'success');
            loadSpayLedger(supId);
          } catch(err) {
            window.ui.toast(err.message, 'error');
          }
        });
      });
    }
  }

  // -------------------------------------------------------------------------
  // Site Expenses View
  // -------------------------------------------------------------------------
  function renderExpView() {
    contentArea.innerHTML =
      '<div class="card" style="margin-bottom:1rem; padding:0.75rem;">' +
        '<div style="display:flex; gap:0.5rem; align-items:center;">' +
          '<label style="font-weight:600; font-size:0.85rem;">' + esc(t('money.select_site') || 'Site:') + '</label>' +
          '<select id="exp-site-select" class="input" style="flex:1;">' +
            '<option value="">' + esc(t('common.loading') || 'Loading sites...') + '</option>' +
          '</select>' +
          '<button id="btn-add-exp" class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.85rem;">+ ' + esc(t('money.add_exp') || 'Record Expense') + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<h3 style="margin-top:0; font-size:1rem;">' + esc(t('money.expense_log') || 'Site Expenses Log') + '</h3>' +
        '<div id="exp-table-container">' +
          '<p class="text-muted" style="font-size:0.85rem;">Select a site to view recorded expenses.</p>' +
        '</div>' +
      '</div>';

    var siteSel = document.getElementById('exp-site-select');
    var btnAddExp = document.getElementById('btn-add-exp');
    var tableContainer = document.getElementById('exp-table-container');

    window.api.call('sites.list', {})
      .then(function(res) {
        var sites = (res && res.items) ? res.items : (res && res.rows ? res.rows : (res && res.data && res.data.rows ? res.data.rows : []));
        siteSel.innerHTML = '<option value="">-- Choose Site --</option>' +
          sites.map(function(s) {
            return '<option value="' + esc(s.site_id) + '">' + esc(s.site_name) + '</option>';
          }).join('');
      });

    siteSel.addEventListener('change', function() {
      var siteId = siteSel.value;
      if (!siteId) {
        tableContainer.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">Select a site.</p>';
        return;
      }
      loadExpList(siteId);
    });

    btnAddExp.addEventListener('click', function() {
      var siteId = siteSel.value;
      if (!siteId) {
        window.ui.toast('Select a site first', 'warning');
        return;
      }
      showAddExpSheet(siteId);
    });

    function loadExpList(siteId) {
      window.api.call('exp.list', { site_id: siteId })
        .then(function(res) {
          var rows = (res && res.rows) ? res.rows : (res && res.items ? res.items : (res && res.data && res.data.rows ? res.data.rows : []));
          if (!rows.length) {
            tableContainer.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No expenses recorded for this site.</p>';
            return;
          }

          tableContainer.innerHTML =
            '<div style="overflow-x:auto;">' +
              '<table class="table" style="width:100%; font-size:0.85rem;">' +
                '<thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Paid To</th><th>Action</th></tr></thead>' +
                '<tbody>' +
                  rows.map(function(e) {
                    var isRev = e.status === 'REVERSED';
                    var amtFormatted = '₹' + (Math.abs(e.amount_paise) / 100).toLocaleString('en-IN');
                    var amtDisplay = e.amount_paise < 0 ? ('-' + amtFormatted) : amtFormatted;

                    return '<tr>' +
                      '<td>' + esc(e.exp_date || '') + '</td>' +
                      '<td>' + esc(e.category) + '</td>' +
                      '<td style="font-weight:600;">' + amtDisplay + '</td>' +
                      '<td>' + esc(e.paid_to || '-') + '</td>' +
                      '<td>' + (!isRev ? '<button class="btn btn-outline btn-rev-exp" data-id="' + esc(e.exp_id) + '" style="padding:0.2rem 0.5rem; font-size:0.75rem;">Reverse</button>' : '') + '</td>' +
                    '</tr>';
                  }).join('') +
                '</tbody>' +
              '</table>' +
            '</div>';

          tableContainer.querySelectorAll('.btn-rev-exp').forEach(function(btn) {
            btn.addEventListener('click', function() {
              var expId = btn.getAttribute('data-id');
              window.ui.showConfirm('Reverse this expense entry?', function() {
                window.ui.withButtonLoading(btn, async function() {
                  try {
                    await window.api.call('exp.reverse', { exp_id: expId, reason: 'Reversed by owner' });
                    window.ui.toast('Expense reversed', 'success');
                    loadExpList(siteId);
                  } catch(err) {
                    window.ui.toast(err.message, 'error');
                  }
                });
              });
            });
          });
        });
    }

    function showAddExpSheet(siteId) {
      var html =
        '<h3>Record Site Expense</h3>' +
        '<div class="form-field">' +
          '<label>Category</label>' +
          '<select id="exp-cat-select" class="input">' +
            '<option value="LABOUR">LABOUR</option>' +
            '<option value="TRANSPORT">TRANSPORT</option>' +
            '<option value="FOOD_TRAVEL">FOOD_TRAVEL</option>' +
            '<option value="DISCOM_FEES">DISCOM_FEES</option>' +
            '<option value="CIVIL">CIVIL</option>' +
            '<option value="WARRANTY_REPLACEMENT">WARRANTY_REPLACEMENT</option>' +
            '<option value="OTHER" selected>OTHER</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Amount (₹)</label>' +
          '<input id="exp-amt-input" type="number" class="input" placeholder="e.g. 5000" min="1">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Paid To</label>' +
          '<input id="exp-paidto-input" class="input" placeholder="Person / Vendor name">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Expense Date</label>' +
          '<input id="exp-date-input" type="date" class="input" value="' + new Date().toISOString().slice(0, 10) + '">' +
        '</div>' +
        '<div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">' +
          '<button id="btn-cancel-exp" class="btn btn-outline">Cancel</button>' +
          '<button id="btn-submit-exp" class="btn btn-primary">Save Expense</button>' +
        '</div>';

      window.ui.showBottomSheet(html);
      document.getElementById('btn-cancel-exp').addEventListener('click', window.ui.hideBottomSheet);
      var submitExpBtn = document.getElementById('btn-submit-exp');
      submitExpBtn.addEventListener('click', function() {
        var inr = Number(document.getElementById('exp-amt-input').value);
        if (!inr || inr <= 0) {
          window.ui.toast('Enter valid amount', 'error');
          return;
        }

        var payload = {
          site_id: siteId,
          category: document.getElementById('exp-cat-select').value,
          amount_paise: Math.round(inr * 100),
          paid_to: document.getElementById('exp-paidto-input').value.trim(),
          exp_date: document.getElementById('exp-date-input').value
        };

        window.ui.withButtonLoading(submitExpBtn, async function() {
          try {
            await window.api.call('exp.add', payload);
            window.ui.hideBottomSheet();
            window.ui.toast('Expense recorded', 'success');
            loadExpList(siteId);
          } catch(err) {
            window.ui.toast(err.message, 'error');
          }
        });
      });
    }
  }
};
