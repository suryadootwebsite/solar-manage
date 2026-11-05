/**
 * suppliers.js — Suppliers standalone page (FIX 1 + FIX 3).
 * Route: /suppliers — OWNER and DEVELOPER only.
 * Features: list, search, sort, add/edit, detail with Payments tab (spay.ledger).
 */

window.pages = window.pages || {};

window.pages.suppliers = async function(container) {
  var t = window.i18n.t;
  var isOwner = window.auth.isOwnerLike(window.auth.getUser() && window.auth.getUser().role);
  var fmt = function(paise) { return '₹' + ((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); };

  container.innerHTML = `
    <div style="margin-bottom:1rem;">
      <h2 style="margin:0 0 0.5rem 0;">${window.ui.esc(t('nav.suppliers'))}</h2>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; gap:0.5rem; flex-wrap:wrap;">
      <div id="sup-search-mount" style="flex:1; min-width:180px;"></div>
      ${isOwner ? `<button id="sup-add-btn" class="btn btn-primary" style="min-height:44px;">+ ${window.ui.esc(t('suppliers.new_btn'))}</button>` : ''}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.75rem;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <label style="font-size:0.85rem;color:var(--text-muted);">Sort:</label>
        <select id="sup-sort-select" class="input" style="width:auto;min-width:140px;font-size:0.85rem;padding:0.25rem 0.5rem;">
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
          <option value="newest">Newest</option>
        </select>
      </div>
      <label style="font-size:0.85rem;color:var(--text-muted);display:inline-flex;align-items:center;gap:0.35rem;cursor:pointer;">
        <input type="checkbox" id="sup-show-inactive-toggle"> Show Inactive
      </label>
    </div>
    <div id="sup-list-container">
      <div style="text-align:center; padding:1.5rem 0;"><span class="spinner"></span></div>
    </div>
  `;

  var listEl = document.getElementById('sup-list-container');
  var addBtn = document.getElementById('sup-add-btn');
  var sortEl = document.getElementById('sup-sort-select');
  var currentSort = localStorage.getItem('sms_sort_suppliers') || 'name_asc';
  var suppliers = [];
  var _offset = 0, _total = 0, _hasMore = true, _loading = false;
  async function _loadMoreSuppliers() {
    if (!_hasMore || _loading) return;
    _loading = true;
    var loadRow = document.createElement('div');
    loadRow.id = 'load-more-row-sup';
    loadRow.style.cssText = 'text-align:center;padding:1rem;color:var(--text-muted);font-size:0.85rem;';
    loadRow.innerHTML = 'Loading more...';
    listEl.appendChild(loadRow);
    try {
      var res = await window.api.call('suppliers.list', { offset: _offset, limit: 40 });
      var el = document.getElementById('load-more-row-sup');
      if (el) el.remove();
      var newItems = res.items || [];
      suppliers = suppliers.concat(newItems);
      _offset += newItems.length;
      _hasMore = res.has_more !== undefined ? res.has_more : (_offset < res.total);
      renderItems(suppliers, currentQuery);
    } catch(e) {
      var el = document.getElementById('load-more-row-sup');
      if (el) el.remove();
    } finally {
      _loading = false;
    }
  }

  function _checkSupScroll() {
    if (!_hasMore || _loading) return;
    var el = document.scrollingElement || document.documentElement || document.body;
    if ((window.innerHeight + window.scrollY) >= (el.scrollHeight - 150)) {
      _loadMoreSuppliers();
    }
  }
  window.addEventListener('scroll', _checkSupScroll);

  var currentQuery = '';
  var showInactive = false;

  var inactToggle = document.getElementById('sup-show-inactive-toggle');
  if (inactToggle) {
    inactToggle.onchange = function() {
      showInactive = inactToggle.checked;
      renderItems(suppliers, currentQuery);
    };
  }

  if (sortEl) {
    sortEl.value = currentSort;
    sortEl.onchange = function() {
      currentSort = sortEl.value;
      localStorage.setItem('sms_sort_suppliers', currentSort);
      renderItems(suppliers, currentQuery);
    };
  }

  try {
    _offset = 0;
    _hasMore = true;
    var res = await window.api.call('suppliers.list', { offset: 0, limit: 40 });
    _total = res.total || (res.items || []).length;
    _offset = (res.items || []).length;
    _hasMore = res.has_more !== undefined ? res.has_more : (_offset < _total);
    suppliers = res.items || [];
    renderItems(suppliers, '');
  } catch(err) {
    listEl.innerHTML = `<div class="card text-error">${window.ui.esc(err.message || 'Failed to load suppliers')}</div>`;
    return;
  }

  if (window.components && window.components.createSearchBar) {
    var sBar = window.components.createSearchBar({
      placeholder: t('suppliers.search_placeholder') || 'Search suppliers...',
      onSearch: function(q) { currentQuery = q; renderItems(suppliers, q); }
    });
    var sm = document.getElementById('sup-search-mount');
    if (sm) sm.appendChild(sBar.element);
  }

  if (addBtn) addBtn.onclick = function() { openSupplierForm(null); };

  function renderItems(items, query) {
    currentQuery = query || '';
    var q = currentQuery.toLowerCase().trim();
    var filtered = items.filter(function(s) {
      if (!showInactive && s.is_active === false) return false;
      if (!q) return true;
      return (s.name || '').toLowerCase().indexOf(q) >= 0 || (s.gst_no || '').toLowerCase().indexOf(q) >= 0;
    });

    if (currentSort === 'name_desc') {
      filtered.sort(function(a, b) { return (b.name || '').localeCompare(a.name || ''); });
    } else if (currentSort === 'newest') {
      filtered.sort(function(a, b) { return (a.supplier_id || '') < (b.supplier_id || '') ? 1 : -1; });
    } else {
      filtered.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
    }

    if (!filtered.length) {
      listEl.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:1.5rem;">${window.ui.esc(t('suppliers.empty'))}</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(function(s) {
      return `
        <div class="card sup-card" data-id="${s.supplier_id}" style="margin-bottom:0.75rem; cursor:pointer;${!s.is_active ? 'opacity:0.65;' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:700; color:var(--text-main); font-size:1.05rem;">${window.ui.esc(s.name)}</div>
              ${s.gst_no ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">GST: <code>${window.ui.esc(s.gst_no)}</code></div>` : ''}
              ${s.phone ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">📞 ${window.ui.esc(s.phone)}</div>` : ''}
            </div>
                          ${s.created_by_name && window.auth && window.auth.getRole && window.auth.getRole() !== 'SITE_USER' ? '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;text-align:right;">Added by ' + window.ui.esc(s.created_by_name) + '</div>' : ''}
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.25rem;">
              <span class="sup-bal-el-${s.supplier_id}" style="font-size:0.8rem;color:var(--text-muted);">
                ${!s.is_active ? '<em style="color:var(--text-muted);">(Inactive)</em>' : ''}
              </span>
              ${s.doc_count ? `<span class="badge" style="font-size:0.75rem; background:#f1f5f9; color:#475569;">📄 ${s.doc_count}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.sup-card').forEach(function(card) {
      card.onclick = function() {
        var id = card.getAttribute('data-id');
        var item = suppliers.find(function(x) { return x.supplier_id === id; });
        if (item) openSupplierDetail(item);
      };
    });

    var callerRole = window.auth && window.auth.getRole ? window.auth.getRole() : '';
    if (callerRole === 'OWNER' || callerRole === 'MANAGER' || callerRole === 'DEVELOPER') {
      filtered.forEach(function(s) {
        if (s.is_active === false) return;
        var el = listEl.querySelector('.sup-bal-el-' + s.supplier_id);
        if (!el) return;
        window.api.call('spay.ledger', { supplier_id: s.supplier_id })
          .then(function(l) {
            var bal = Number(l.balance_pending_paise || 0);
            el.innerHTML = bal > 0
              ? '<span style="color:#dc2626;font-weight:600;">Balance: ₹' + Math.round(bal/100).toLocaleString('en-IN') + '</span>'
              : '<span style="color:#16a34a;">Cleared ✓</span>';
          }).catch(function() {});
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Detail — 2 tabs: Details | Payments (OWNER/DEVELOPER only)
  // ---------------------------------------------------------------------------
  function openSupplierDetail(s) {
    var showPayments = isOwner || window.auth.can('spay.ledger');
    var detailHtml = `
      <div style="display:flex; gap:0.5rem; margin-bottom:1rem; border-bottom:2px solid var(--border); padding-bottom:0.5rem;">
        <button class="btn btn-primary sup-dtab-btn" data-tab="details" style="flex:1;">Details</button>
        ${showPayments ? `<button class="btn btn-secondary sup-dtab-btn" data-tab="payments" style="flex:1;">Payments</button>` : ''}
      </div>
      <div id="sup-dtab-details">
        <div style="font-weight:700; font-size:1.15rem; color:var(--text-main); margin-bottom:0.25rem;">${window.ui.esc(s.name)}</div>
        ${s.gst_no ? `<div style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.25rem;">GST: <code>${window.ui.esc(s.gst_no)}</code></div>` : ''}
        ${s.phone ? `<div style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.25rem;">📞 <a href="tel:${window.ui.esc(s.phone)}">${window.ui.esc(s.phone)}</a></div>` : ''}
        ${s.address ? `<div style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.5rem;">📍 ${window.ui.esc(s.address)}</div>` : ''}
        <div style="margin-top:0.75rem;">
          ${isOwner ? `<button id="btn-edit-sup-detail" class="btn btn-outline btn-sm">Edit Details</button>` : ''}
        </div>
        <div id="sup-detail-docs-mount" style="margin-top:1rem;"></div>
      </div>
      <div id="sup-dtab-payments" style="display:none;">
        <div style="text-align:center; padding:1.5rem 0;"><span class="spinner"></span></div>
      </div>
    `;
    window.ui.openBottomSheet('Supplier: ' + s.name, detailHtml, '');

    // Tab switching
    document.querySelectorAll('.sup-dtab-btn').forEach(function(btn) {
      btn.onclick = function() {
        document.querySelectorAll('.sup-dtab-btn').forEach(function(b) {
          b.classList.remove('btn-primary'); b.classList.add('btn-secondary');
        });
        btn.classList.add('btn-primary'); btn.classList.remove('btn-secondary');
        var tab = btn.getAttribute('data-tab');
        document.getElementById('sup-dtab-details').style.display = tab === 'details' ? '' : 'none';
        document.getElementById('sup-dtab-payments').style.display = tab === 'payments' ? '' : 'none';
        if (tab === 'payments') loadSupplierPayments(s);
      };
    });

    // Edit button
    var editBtn = document.getElementById('btn-edit-sup-detail');
    if (editBtn) editBtn.onclick = function() { openSupplierForm(s); };

    // Documents
    if (window.components && window.components.renderDocumentsSection) {
      var mount = document.getElementById('sup-detail-docs-mount');
      if (mount) {
        try { window.components.renderDocumentsSection(mount, 'SUPPLIER', s.supplier_id, s.name); }
        catch(e) { mount.innerHTML = '<div class="text-muted" style="font-size:0.85rem;padding:0.5rem 0;">Documents unavailable</div>'; }
      }
    }
  }

  async function loadSupplierPayments(s) {
    var payTab = document.getElementById('sup-dtab-payments');
    if (!payTab) return;
    payTab.innerHTML = '<div style="text-align:center;padding:1.5rem 0;"><span class="spinner"></span></div>';
    try {
      var ledger = await window.api.call('spay.ledger', { supplier_id: s.supplier_id });
      var pendingLots = (ledger.lots || []).filter(function(l) { return l.pending_paise > 0; });

      var summaryHtml = `
        <div style="display:flex; gap:0.5rem; margin-bottom:1rem;">
          <div class="card" style="flex:1; text-align:center; padding:0.5rem;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Purchased</div>
            <div style="font-weight:700; font-size:0.95rem;">${fmt(ledger.total_purchased_paise)}</div>
          </div>
          <div class="card" style="flex:1; text-align:center; padding:0.5rem;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Paid</div>
            <div style="font-weight:700; font-size:0.95rem; color:#16a34a;">${fmt(ledger.total_paid_paise)}</div>
          </div>
          <div class="card" style="flex:1; text-align:center; padding:0.5rem;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Balance</div>
            <div style="font-weight:700; font-size:0.95rem; color:${ledger.balance_pending_paise > 0 ? '#dc2626' : '#16a34a'};">${fmt(ledger.balance_pending_paise)}</div>
          </div>
        </div>
      `;

      var lotsHtml = (ledger.lots || []).length ? `
        <div style="font-weight:700; font-size:0.9rem; margin-bottom:0.5rem;">Lot Breakdown</div>
        ${(ledger.lots || []).map(function(l) {
          var color = l.pending_paise <= 0 ? '#16a34a' : (l.paid_paise > 0 ? '#d97706' : '#dc2626');
          return `
            <div style="display:flex; justify-content:space-between; padding:0.4rem 0; border-bottom:1px solid var(--border); font-size:0.85rem;">
              <span>${window.ui.esc(l.invoice_no || l.lot_id)}</span>
              <span style="color:${color}; font-weight:600;">${fmt(l.pending_paise)} pending</span>
            </div>
          `;
        }).join('')}
        <div style="margin-bottom:1rem;"></div>
      ` : '';

      var payments = ledger.payments || [];
      var paymentsHtml = payments.length
        ? '<div style="font-weight:700;font-size:0.9rem;margin:0.75rem 0 0.4rem;">Payment History</div>'
          + payments.map(function(p) {
              var amt = '₹' + Math.round((Number(p.amount_paise)||0)/100).toLocaleString('en-IN');
              var pDate = p.pay_date || p.payment_date || '';
              var pMode = p.mode || p.payment_mode || 'BANK';
              return '<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.85rem;">'
                + '<div>'
                + '<div style="font-weight:600;">' + amt
                + ' <span class="badge" style="font-size:0.7rem;">' + window.ui.esc(pMode) + '</span>'
                + (p.document_url ? ' <a href="' + window.ui.esc(p.document_url) + '" target="_blank" rel="noopener" style="font-size:0.75rem;">📎 Proof</a>' : '')
                + '</div>'
                + '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">'
                + window.ui.esc(pDate)
                + (p.lot_invoice ? ' · ' + window.ui.esc(p.lot_invoice) : '')
                + (p.remark ? ' · ' + window.ui.esc(p.remark) : '')
                + '</div></div></div>';
            }).join('')
          + '<div style="margin-bottom:1rem;"></div>'
        : '<div style="text-align:center;padding:1rem 0;font-size:0.85rem;color:var(--text-muted);">No payments recorded yet.</div>';

      var addPayBtn = isOwner ? `
        <button id="sup-add-pay-btn" class="btn btn-primary btn-full" style="margin-top:1rem;">+ Add Payment</button>
      ` : '';

      payTab.innerHTML = summaryHtml + lotsHtml + paymentsHtml + addPayBtn;

      if (isOwner) {
        var apBtn = document.getElementById('sup-add-pay-btn');
        if (apBtn) {
          apBtn.onclick = function() { openAddSupplierPayment(s, pendingLots, function() { loadSupplierPayments(s); }); };
        }
      }
    } catch(e) {
      payTab.innerHTML = `<div class="card text-error">${window.ui.esc(e.message || 'Failed to load payments')}</div>`;
    }
  }

  function openAddSupplierPayment(s, pendingLots, onDone) {
    var lotOptions = pendingLots.map(function(l) {
      return `<option value="${l.lot_id}">${window.ui.esc(l.invoice_no || l.lot_id)} (${fmt(l.pending_paise)} pending)</option>`;
    }).join('');

    var formHtml = `
      <form id="spay-form" novalidate>
        <div class="form-field">
          <label>Lot *</label>
          <select id="spf-lot" class="input">
            <option value="">-- Select Lot --</option>
            ${lotOptions}
          </select>
        </div>
        <div class="form-field">
          <label>Amount (₹) *</label>
          <input id="spf-amount" type="number" class="input" min="1" step="1" placeholder="e.g. 5000">
        </div>
        <div class="form-field">
          <label>Date *</label>
          <input id="spf-date" type="date" class="input" value="${new Date().toISOString().slice(0,10)}">
        </div>
        <div class="form-field">
          <label>Mode</label>
          <select id="spf-mode" class="input">
            <option value="BANK">Bank Transfer</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
            <option value="UPI">UPI</option>
          </select>
        </div>
        <div class="form-field">
          <label>Remark</label>
          <input id="spf-remark" type="text" class="input">
        </div>
        <div id="spf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <div class="sheet-footer" style="padding-top:0.75rem; border-top:1px solid var(--border);">
          <button type="submit" id="spf-submit" class="btn btn-primary btn-full">Add Payment</button>
        </div>
      </form>
    `;
    window.ui.openBottomSheet('Add Supplier Payment — ' + s.name, formHtml, '');

    document.getElementById('spay-form').onsubmit = function(e) {
      e.preventDefault();
      var errEl = document.getElementById('spf-error');
      var submitBtn = document.getElementById('spf-submit');
      errEl.style.display = 'none';
      var lotId = document.getElementById('spf-lot').value;
      var amount = parseFloat(document.getElementById('spf-amount').value);
      if (!lotId) { errEl.textContent = 'Select a lot'; errEl.style.display = 'block'; return; }
      if (!amount || amount <= 0) { errEl.textContent = 'Enter a valid amount'; errEl.style.display = 'block'; return; }

      window.ui.withButtonLoading(submitBtn, async function() {
        await window.api.call('spay.add', {
          supplier_id: s.supplier_id,
          lot_id: lotId,
          amount_paise: Math.round(amount * 100),
          pay_date: document.getElementById('spf-date').value,
          mode: document.getElementById('spf-mode').value,
          remark: document.getElementById('spf-remark').value.trim()
        });
        window.ui.closeBottomSheet();
        window.ui.showToast('Payment added', 'success');
        if (onDone) onDone();
      }).catch(function(err) {
        errEl.textContent = err.message || 'Failed to add payment';
        errEl.style.display = 'block';
      });
    };
  }

  // ---------------------------------------------------------------------------
  // Add / Edit Supplier Form
  // ---------------------------------------------------------------------------
  function openSupplierForm(s) {
    var isEdit = Boolean(s);
    var title = isEdit ? 'Edit Supplier' : t('suppliers.new_btn');
    var formHtml = `
      <form id="sup-form" novalidate>
        <div class="form-field">
          <label>${window.ui.esc(t('suppliers.name_label'))} *</label>
          <input id="sf-name" type="text" class="input" value="${s ? window.ui.esc(s.name) : ''}" required>
        </div>
        <div class="form-field">
          <label>${window.ui.esc(t('suppliers.gst_label'))}</label>
          <input id="sf-gst" type="text" class="input" maxlength="15" value="${s ? window.ui.esc(s.gst_no || '') : ''}">
        </div>
        <div class="form-field">
          <label>${window.ui.esc(t('suppliers.phone_label'))}</label>
          <input id="sf-phone" type="tel" class="input" value="${s ? window.ui.esc(s.phone || '') : ''}">
        </div>
        <div class="form-field">
          <label>${window.ui.esc(t('suppliers.address_label'))}</label>
          <textarea id="sf-address" class="input" rows="2">${s ? window.ui.esc(s.address || '') : ''}</textarea>
        </div>
        <div id="sf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <div class="sheet-footer" style="padding-top:0.75rem; border-top:1px solid var(--border);">
          <button type="submit" id="sf-submit" class="btn btn-primary btn-full">${window.ui.esc(t('btn.save'))}</button>
        </div>
      </form>
    `;
    window.ui.openBottomSheet(title, formHtml, '');

    document.getElementById('sup-form').onsubmit = function(e) {
      e.preventDefault();
      var errEl = document.getElementById('sf-error');
      var submitBtn = document.getElementById('sf-submit');
      errEl.style.display = 'none';
      var payload = {
        name: document.getElementById('sf-name').value.trim(),
        gst_no: document.getElementById('sf-gst').value.trim().toUpperCase(),
        phone: document.getElementById('sf-phone').value.trim(),
        address: document.getElementById('sf-address').value.trim()
      };
      if (!payload.name) { errEl.textContent = 'Supplier name is required'; errEl.style.display = 'block'; return; }

      window.ui.withButtonLoading(submitBtn, async function() {
        if (isEdit) { payload.supplier_id = s.supplier_id; await window.api.call('suppliers.update', payload); }
        else { await window.api.call('suppliers.create', payload); }
        window.ui.closeBottomSheet();
        window.ui.showToast(isEdit ? 'Supplier updated' : 'Supplier created', 'success');
        // Refresh list
        var res2 = await window.api.call('suppliers.list', {});
        suppliers = res2.items || [];
        renderItems(suppliers, '');
      }).catch(function(err) {
        errEl.textContent = err.message || 'Operation failed';
        errEl.style.display = 'block';
      });
    };
  }
};
