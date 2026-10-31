/**
 * lots.js — Purchase Lots Entry and Management Screen (Doc 06 S13, S14).
 * Accessible by OWNER (full financials) and MANAGER (qty-only / PENDING_RATE).
 */

window.pages = window.pages || {};

window.pages.lots = async function(container) {
  var t = window.i18n.t;
  var isOwner = window.auth.isOwnerLike(window.auth.getUser() && window.auth.getUser().role);

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
      <div>
        <h2 style="margin:0;">${window.ui.esc(t('lots.title'))}</h2>
        <p class="text-muted" style="margin:0.25rem 0 0; font-size:0.875rem;">${window.ui.esc(t('lots.subtitle'))}</p>
      </div>
      <button id="lot-new-btn" class="btn btn-primary" style="min-height:44px;">+ ${window.ui.esc(t('lots.new_btn'))}</button>
    </div>

    <!-- Sort control (B4/B5) -->
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
      <label style="font-size:0.85rem;color:var(--text-muted);">Sort:</label>
      <select id="lots-sort-select" class="input" style="width:auto;min-width:140px;font-size:0.85rem;padding:0.25rem 0.5rem;">
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="supplier">Supplier A-Z</option>
      </select>
    </div>

    <div id="lots-search-mount"></div>
    <!-- Filter chips (Task P3-2) -->
    <div class="lot-chips-container">
      <button class="btn btn-primary lot-filter-btn active" data-status="" style="min-height:34px; height:34px; font-size:13px; padding:0 0.75rem; line-height:32px; border-radius:17px; flex-shrink:0;">All</button>
      <button class="btn btn-secondary lot-filter-btn" data-status="ORDER_CONFIRMED" style="min-height:34px; height:34px; font-size:13px; padding:0 0.75rem; line-height:32px; border-radius:17px; flex-shrink:0;">Confirmed</button>
      <button class="btn btn-secondary lot-filter-btn" data-status="DISPATCHED" style="min-height:34px; height:34px; font-size:13px; padding:0 0.75rem; line-height:32px; border-radius:17px; flex-shrink:0;">Dispatched</button>
      <button class="btn btn-secondary lot-filter-btn" data-status="DELIVERED" style="min-height:34px; height:34px; font-size:13px; padding:0 0.75rem; line-height:32px; border-radius:17px; flex-shrink:0;">Delivered</button>
      <button class="btn btn-secondary lot-filter-btn" data-status="RETURNED" style="min-height:34px; height:34px; font-size:13px; padding:0 0.75rem; line-height:32px; border-radius:17px; flex-shrink:0;">Returned</button>
      <button class="btn btn-secondary lot-filter-btn" data-status="PENDING_RATE" style="min-height:34px; height:34px; font-size:13px; padding:0 0.75rem; line-height:32px; border-radius:17px; flex-shrink:0;">Pending Rate</button>
    </div>

    <div id="lot-list-view">
      <div style="text-align:center; padding:2rem 0;"><span class="spinner"></span></div>
    </div>
  `;

  var listView = document.getElementById('lot-list-view');
  var newBtn = document.getElementById('lot-new-btn');
  var filterButtons = container.querySelectorAll('.lot-filter-btn');
  var sortSelect = document.getElementById('lots-sort-select');

  var currentSortLots = localStorage.getItem('sms_sort_lots') || 'newest';
  if (sortSelect) {
    sortSelect.value = currentSortLots;
    sortSelect.onchange = function() {
      currentSortLots = sortSelect.value;
      localStorage.setItem('sms_sort_lots', currentSortLots);
      renderLots();
    };
  }

  var lotsSearchQuery = "";
  if (window.components && window.components.createSearchBar) {
    var sBar = window.components.createSearchBar({
      placeholder: t("lots.search_placeholder") || "Search invoice no, lot ID, supplier...",
      onSearch: function(q) {
        lotsSearchQuery = q;
        renderLots();
      }
    });
    var lm = document.getElementById("lots-search-mount");
    if (lm) lm.appendChild(sBar.element);
  }

  var currentStatusFilter = '';
  var lots = [];
  var suppliers = [];
  var locations = [];
  var products = [];

  // Load masters for name lookups
  try {
    var [supRes, locRes, prdRes] = await Promise.all([
      window.api.call('suppliers.list', {}),
      window.api.call('locations.list', {}),
      window.api.call('products.list', {})
    ]);
    suppliers = supRes.items || [];
    locations = locRes.items || [];
    products = prdRes.items || [];
  } catch(e) {
    console.warn('Could not load some masters for lot screen', e);
  }

  function getSupplierName(id) {
    var s = suppliers.find(function(x) { return x.supplier_id === id; });
    return s ? s.name : id;
  }

  function getLocationName(id) {
    var l = locations.find(function(x) { return x.location_id === id; });
    return l ? l.name : id;
  }

  async function loadLots() {
    try {
      var payload = {};
      if (currentStatusFilter) payload.status = currentStatusFilter;
      var res = await window.api.call('lots.list', payload);
      lots = res.items || [];
      renderLots();
    } catch(err) {
      listView.innerHTML = `<div class="card text-error" style="text-align:center;">${window.ui.esc(err.message || 'Failed to load lots')}</div>`;
    }
  }

  function sortLotsList(list, sortVal) {
    var arr = list.slice();
    if (sortVal === 'newest') {
      return arr;
    } else if (sortVal === 'oldest') {
      return arr.reverse();
    } else if (sortVal === 'supplier') {
      arr.sort(function(a, b) {
        var sa = getSupplierName(a.supplier_id) || '';
        var sb = getSupplierName(b.supplier_id) || '';
        return sa.localeCompare(sb);
      });
      return arr;
    }
    return arr;
  }

  function renderLots() {
    if (!lots.length) {
      listView.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:2rem 1rem;">${window.ui.esc(t('lots.empty'))}</div>`;
      return;
    }

    var displayLots = sortLotsList(lots, currentSortLots);
    if (lotsSearchQuery && window.components && window.components.filterListByQuery) {
      displayLots = window.components.filterListByQuery(displayLots, lotsSearchQuery, ['lot_id', 'invoice_no', 'supplier_id', 'items_summary', 'order_status']);
    }

    listView.innerHTML = displayLots.map(function(l) {
      var ordStatus = l.order_status || '';
      if (!ordStatus) {
        console.warn('[lots] Missing order_status for lot', l.lot_id);
      }
      var ordClass = ordStatus === 'DELIVERED' ? 'badge-success' : (ordStatus === 'DISPATCHED' ? 'badge-primary' : (ordStatus === 'RETURNED' ? 'badge-danger' : (ordStatus ? 'badge-warning' : 'badge-disabled')));
      var localizedOrdStatus = ordStatus ? (t('lots.status_' + ordStatus.toLowerCase()) || ordStatus) : 'Unknown';
      var isPendingRate = l.status === 'PENDING_RATE';
      var totalText = isOwner && l.grand_total_paise !== undefined ? `₹${(l.grand_total_paise / 100).toLocaleString('en-IN')}` : '';

      return `
        <div class="card lot-card" data-id="${l.lot_id}" style="margin-bottom:0.75rem; cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:700; font-size:1.05rem; color:var(--text-main);">
                ${window.ui.esc(l.items_summary || getSupplierName(l.supplier_id))}
              </div>
              <div style="font-size:0.875rem; color:var(--text-muted); margin-top:0.25rem;">
                ${window.ui.esc(getSupplierName(l.supplier_id))} · Inv: <strong>${window.ui.esc(l.invoice_no)}</strong> · Date: ${window.ui.esc(l.lot_date)}
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
                📍 ${window.ui.esc(getLocationName(l.location_id))}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.25rem;">
                <span class="badge ${ordClass}">${window.ui.esc(localizedOrdStatus)}</span>
                ${isPendingRate ? '<span class="badge badge-warning" style="font-size:0.7rem; padding:0.15rem 0.45rem;">Rate pending</span>' : ''}
              </div>
              ${l.doc_count ? `<span class="badge" style="font-size:0.75rem; background:#f1f5f9; color:#475569; margin-top:0.25rem;">📄 ${l.doc_count} docs</span>` : ''}
              ${totalText ? `<div style="font-weight:700; margin-top:0.5rem; color:var(--brand);">${totalText}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    listView.querySelectorAll('.lot-card').forEach(function(card) {
      card.onclick = function() {
        var id = card.getAttribute('data-id');
        openLotDetail(id);
      };
    });
  }

  filterButtons.forEach(function(btn) {
    btn.onclick = function() {
      filterButtons.forEach(function(b) { b.classList.remove('active', 'btn-primary'); b.classList.add('btn-secondary'); });
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-secondary');
      currentStatusFilter = btn.getAttribute('data-status');
      loadLots();
    };
  });

  // ---------------------------------------------------------------------------
  // Lot Details Modal
  // ---------------------------------------------------------------------------
  async function openLotDetail(lotId) {
    window.ui.showSpinner();
    try {
      var res = await window.api.call('lots.get', { lot_id: lotId });
      var lot = res.lot;
      var items = res.items || [];
      var batches = res.batches || [];
      if (res.allowed_next) lot.allowed_next = res.allowed_next;
      window.ui.hideSpinner();

      var itemsHtml = items.map(function(it) {
        var prd = products.find(function(p) { return p.product_id === it.product_id; });
        var prdName = prd ? prd.name : it.product_id;
        var costInfo = isOwner && it.landed_unit_paise ? `· Landed: ₹${(it.landed_unit_paise / 100).toFixed(2)}/unit` : '';

        return `
          <div style="padding:0.5rem 0; border-bottom:1px solid var(--border);">
            <div style="font-weight:600;">${window.ui.esc(prdName)}</div>
            <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
              Qty: <strong>${it.qty}</strong> ${costInfo}
            </div>
          </div>
        `;
      }).join('');

      var canSetRate = isOwner && lot.status === 'PENDING_RATE';
      var canCancel = isOwner && lot.status !== 'CANCELLED';
      var curOrd = lot.order_status || '';
      var canUpdateOrd = curOrd !== 'DELIVERED' && curOrd !== 'RETURNED' && curOrd !== 'CANCELLED' && Boolean(curOrd);

      // Timeline HTML
      var timelineSteps = [
        { key: 'ORDER_CONFIRMED', label: t('lots.status_confirmed') || 'Order Confirmed', date: lot.created_at ? lot.created_at.slice(0, 10) : '' },
        { key: 'DISPATCHED', label: t('lots.status_dispatched') || 'Dispatched', date: lot.dispatched_on || (curOrd === 'DISPATCHED' || curOrd === 'DELIVERED' ? 'Done' : '') },
        { key: 'DELIVERED', label: t('lots.status_delivered') || 'Delivered', date: lot.delivered_on || (curOrd === 'DELIVERED' ? 'Done' : '') }
      ];
      if (curOrd === 'RETURN_IN_PROGRESS' || curOrd === 'RETURNED') {
        timelineSteps.push({ key: curOrd, label: curOrd === 'RETURNED' ? t('lots.status_returned') : t('lots.status_return_in_progress'), date: lot.returned_on || '' });
      }

      var timelineHtml = `
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:0.75rem; margin-bottom:1rem;">
          <div style="font-weight:700; font-size:0.85rem; margin-bottom:0.5rem;">${window.ui.esc(t('lots.timeline'))}</div>
          <div style="display:flex; justify-content:space-between; position:relative; gap:0.25rem;">
            ${timelineSteps.map(function(st, idx) {
              var isReached = (curOrd === st.key) || (st.key === 'ORDER_CONFIRMED') || (st.key === 'DISPATCHED' && curOrd === 'DELIVERED');
              var dotColor = isReached ? 'var(--brand)' : 'var(--border)';
              var textColor = isReached ? 'var(--text-main)' : 'var(--text-muted)';
              return `
                <div style="flex:1; text-align:center; font-size:0.75rem;">
                  <div style="width:12px; height:12px; border-radius:50%; background:${dotColor}; margin:0 auto 4px;"></div>
                  <div style="font-weight:600; color:${textColor};">${st.label}</div>
                  ${st.date ? `<div style="font-size:0.7rem; color:var(--text-muted);">${st.date}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      var bodyHtml = `
        <div style="margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span>Supplier:</span>
            <strong>${window.ui.esc(getSupplierName(lot.supplier_id))}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span>Invoice No:</span>
            <strong>${window.ui.esc(lot.invoice_no)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span>Location:</span>
            <strong>${window.ui.esc(getLocationName(lot.location_id))}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span>Order Status:</span>
            <strong><span class="badge badge-primary">${curOrd}</span></strong>
          </div>
          ${isOwner && lot.grand_total_paise !== undefined ? `
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; color:var(--brand); font-weight:bold;">
              <span>Grand Total:</span>
              <span>₹${(lot.grand_total_paise / 100).toLocaleString('en-IN')}</span>
            </div>
          ` : ''}
        </div>
        ${timelineHtml}
        <div style="font-weight:700; margin-bottom:0.5rem;">Line Items:</div>
        <div style="margin-bottom:1rem;">
          ${itemsHtml}
        </div>
        <div id="lot-docs-mount" style="margin-bottom:1.5rem;"></div>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          ${canUpdateOrd ? `<button id="lot-update-status-btn" class="btn btn-primary btn-full">${window.ui.esc(t('lots.update_status_btn'))}</button>` : ''}
          ${canSetRate ? `<button id="lot-set-rate-btn" class="btn btn-secondary btn-full">Set Rates (Back-fill)</button>` : ''}
          ${canCancel ? `<button id="lot-cancel-btn" class="btn btn-secondary btn-full" style="color:var(--danger, #dc2626);">Cancel Lot</button>` : ''}
        </div>
      `;

      window.ui.openBottomSheet('Purchase Lot: ' + (lot.invoice_no || lot.lot_id), bodyHtml, '');

      if (window.components && window.components.renderDocumentsSection) {
        var lotDocMount = document.getElementById('lot-docs-mount');
        if (lotDocMount) {
          window.components.renderDocumentsSection(lotDocMount, 'LOT', lot.lot_id, lot.invoice_no);
        }
      }

      if (canUpdateOrd) {
        document.getElementById('lot-update-status-btn').onclick = function() {
          window.ui.closeBottomSheet();
          openUpdateOrderStatusDialog(lot, items, batches);
        };
      }

      if (canSetRate) {
        document.getElementById('lot-set-rate-btn').onclick = function() {
          window.ui.closeBottomSheet();
          openSetRatesForm(lot, items);
        };
      }

      if (canCancel) {
        var cancelBtn = document.getElementById('lot-cancel-btn');
        cancelBtn.onclick = function() {
          window.ui.confirmDialog(
            'Cancel Lot',
            'Are you sure you want to cancel lot ' + lot.invoice_no + '? Stock will be voided.',
            function() {
              window.ui.withButtonLoading(cancelBtn, async function() {
                try {
                  await window.api.call('lots.cancel', { lot_id: lot.lot_id, reason: 'Cancelled by user' });
                  window.ui.toast('Lot cancelled', 'success');
                  loadLots();
                } catch(e) {
                  window.ui.toast(e.message || 'Cancel failed', 'error');
                }
              });
            }
          );
        };
      }

    } catch(err) {
      window.ui.hideSpinner();
      window.ui.toast(err.message || 'Failed to get lot details', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Update Order Status Dialog
  // ---------------------------------------------------------------------------
  function openUpdateOrderStatusDialog(lot, items, batches) {
    var lotDetail = lot;
    if (!lotDetail.allowed_next) {
      var transitions = {
        'ORDER_CONFIRMED': ['DISPATCHED', 'DELIVERED'],
        'DISPATCHED': ['DELIVERED'],
        'DELIVERED': ['RETURN_IN_PROGRESS'],
        'RETURN_IN_PROGRESS': ['RETURNED']
      };
      lotDetail.allowed_next = transitions[lotDetail.order_status] || [];
    }
    var cur = lotDetail.order_status || '';
    var nextOpts = (lotDetail.allowed_next || []).map(function(s) {
      return '<option value="' + s + '">' + s.replace(/_/g,' ') + '</option>';
    }).join('');

    var formHtml = `
      <form id="update-ord-status-form" novalidate>
        <p class="text-muted" style="margin:0 0 1rem 0;">Current Status: <strong>${cur || 'None'}</strong></p>
        <div class="form-field">
          <label>Target Status *</label>
          <select id="uos-status" class="input" required>
            ${nextOpts}
          </select>
        </div>
        <div class="form-field" id="uos-reason-wrap" style="display:none;">
          <label>Reason *</label>
          <input type="text" id="uos-reason" class="input" placeholder="e.g. Defective items returned">
        </div>
        <div class="form-field" id="uos-date-wrap">
          <label>Action Date</label>
          <input type="date" id="uos-date" class="input" value="${new Date().toISOString().slice(0, 10)}">
        </div>

        <div id="uos-return-details" style="display:none; margin:0.75rem 0; padding:0.75rem; background:var(--bg-card); border-radius:6px; border:1px solid var(--border);">
          <div style="font-weight:600; font-size:0.85rem; margin-bottom:0.5rem;">Return Item Quantities</div>
          ${(items || []).map(function(it) {
            var prd = products.find(function(p) { return p.product_id === it.product_id; });
            var b = (batches || []).find(function(batch) { return batch.lot_item_id === it.lot_item_id; });
            var maxQty = b ? Number(b.qty_remaining || 0) : Number(it.qty || 0);
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; gap:0.5rem;">
                <div style="font-size:0.8rem; flex:2;">
                  <div style="font-weight:600;">${window.ui.esc(prd ? prd.name : it.product_id)}</div>
                  <div class="text-muted" style="font-size:0.75rem;">Max avail: ${maxQty}</div>
                </div>
                <div style="flex:1; max-width:100px;">
                  <input type="number" class="input uos-ret-qty" data-id="${it.lot_item_id}" data-max="${maxQty}" value="${maxQty}" min="0" max="${maxQty}" style="font-size:0.85rem; padding:0.25rem 0.5rem;">
                </div>
              </div>
            `;
          }).join('')}
          ${isOwner ? `
            <div class="form-field" style="margin-top:0.75rem; border-top:1px solid var(--border); padding-top:0.5rem;">
              <label style="font-size:0.8rem;">Return Amount Credit (₹)</label>
              <input type="number" step="0.01" id="uos-return-amount" class="input" placeholder="Amount to deduct from supplier ledger">
            </div>
          ` : ''}
        </div>

        <div id="uos-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="uos-submit" class="btn btn-primary btn-full" ${nextOpts.length === 0 ? 'disabled' : ''}>Save Order Status</button>
      </form>
    `;

    window.ui.openBottomSheet('Update Status: ' + (lot.invoice_no || lot.lot_id), formHtml, '');

    var statusSelect = document.getElementById('uos-status');
    var reasonWrap = document.getElementById('uos-reason-wrap');
    var returnDetails = document.getElementById('uos-return-details');

    function checkVisibility() {
      var val = statusSelect.value;
      reasonWrap.style.display = (val === 'CANCELLED' || val === 'RETURN_IN_PROGRESS' || val === 'RETURNED') ? 'block' : 'none';
      if (returnDetails) {
        returnDetails.style.display = (val === 'RETURNED') ? 'block' : 'none';
      }
    }
    statusSelect.onchange = checkVisibility;
    checkVisibility();

    document.getElementById('update-ord-status-form').onsubmit = async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('uos-error');
      var submitBtn = document.getElementById('uos-submit');
      errEl.style.display = 'none';

      var toStatus = statusSelect.value;
      var reason = document.getElementById('uos-reason').value.trim();
      var actionDate = document.getElementById('uos-date').value;

      if ((toStatus === 'CANCELLED' || toStatus === 'RETURN_IN_PROGRESS' || toStatus === 'RETURNED') && !reason) {
        errEl.textContent = 'Reason is required for cancellation or returns';
        errEl.style.display = 'block';
        return;
      }

      var payload = {
        lot_id: lot.lot_id,
        order_status: toStatus
      };
      if (toStatus === 'DISPATCHED') payload.dispatched_on = actionDate;
      if (toStatus === 'DELIVERED') payload.delivered_on = actionDate;
      if (toStatus === 'RETURN_IN_PROGRESS' || toStatus === 'RETURNED') {
        payload.returned_on = actionDate;
        payload.return_reason = reason;
      }
      if (toStatus === 'CANCELLED') payload.reason = reason;

      if (toStatus === 'RETURNED') {
        var retInputs = document.querySelectorAll('.uos-ret-qty');
        var retItems = [];
        for (var i = 0; i < retInputs.length; i++) {
          var q = parseInt(retInputs[i].value, 10) || 0;
          var m = parseInt(retInputs[i].getAttribute('data-max'), 10) || 0;
          if (q > m) {
            errEl.textContent = 'Return quantity cannot exceed remaining stock (' + m + ')';
            errEl.style.display = 'block';
            return;
          }
          if (q > 0) {
            retItems.push({
              lot_item_id: retInputs[i].getAttribute('data-id'),
              qty: q
            });
          }
        }
        if (retItems.length > 0) {
          payload.items = retItems;
        }
        var retAmtEl = document.getElementById('uos-return-amount');
        if (retAmtEl && retAmtEl.value !== '') {
          var amt = parseFloat(retAmtEl.value);
          if (!isNaN(amt) && amt > 0) {
            payload.return_amount_paise = Math.round(amt * 100);
          }
        }
      }

      window.ui.withButtonLoading(submitBtn, async function() {
        try {
          await window.api.call('lots.updateOrderStatus', payload);
          window.ui.closeBottomSheet();
          window.ui.toast('Order status updated to ' + toStatus, 'success');
          loadLots();
        } catch(err) {
          errEl.textContent = err.message || 'Update failed';
          errEl.style.display = 'block';
        }
      });
    };
  }
  function openSetRatesForm(lot, items) {
    var linesHtml = items.map(function(it, idx) {
      var prd = products.find(function(p) { return p.product_id === it.product_id; });
      return `
        <div style="margin-bottom:0.75rem; padding:0.5rem; background:var(--bg-card); border-radius:6px;">
          <div style="font-weight:600; margin-bottom:0.25rem;">${window.ui.esc(prd ? prd.name : it.product_id)} (Qty: ${it.qty})</div>
          <div style="display:flex; gap:0.5rem;">
            <input type="number" step="0.01" class="input srf-rate" data-id="${it.lot_item_id}" placeholder="Rate (₹)" required style="flex:2;">
            <input type="number" class="input srf-gst" data-id="${it.lot_item_id}" placeholder="GST %" value="${prd ? (prd.default_gst_rate || 12) : 12}" style="flex:1;">
          </div>
        </div>
      `;
    }).join('');

    var formHtml = `
      <form id="set-rates-form" novalidate>
        <p class="text-muted" style="font-size:0.85rem; margin:0 0 0.75rem 0;">Enter purchase rates and charges to finalize valuation.</p>
        ${linesHtml}
        <div class="form-field">
          <label>Transport Charges (₹)</label>
          <input type="number" step="0.01" id="srf-transport" class="input" value="0">
        </div>
        <div class="form-field">
          <label>Loading / Labor (₹)</label>
          <input type="number" step="0.01" id="srf-loading" class="input" value="0">
        </div>
        <div class="form-field">
          <label>Other Charges (₹)</label>
          <input type="number" step="0.01" id="srf-other" class="input" value="0">
        </div>
        <div class="form-field">
          <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
            <input type="checkbox" id="srf-gst-cost">
            <span>Include GST in Cost (No ITC)</span>
          </label>
        </div>
        <div id="srf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="srf-submit" class="btn btn-primary btn-full">Save & Finalize Rates</button>
      </form>
    `;

    window.ui.openBottomSheet('Back-fill Rates: ' + lot.invoice_no, formHtml, '');

    document.getElementById('set-rates-form').onsubmit = async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('srf-error');
      var submitBtn = document.getElementById('srf-submit');
      errEl.style.display = 'none';

      var rateInputs = document.querySelectorAll('.srf-rate');
      var gstInputs = document.querySelectorAll('.srf-gst');

      var itemPayloads = [];
      for (var i = 0; i < rateInputs.length; i++) {
        var rVal = parseFloat(rateInputs[i].value);
        if (isNaN(rVal) || rVal <= 0) {
          errEl.textContent = 'Please enter valid rates for all line items.';
          errEl.style.display = 'block';
          return;
        }
        itemPayloads.push({
          lot_item_id: rateInputs[i].getAttribute('data-id'),
          rate_paise: Math.round(rVal * 100),
          gst_rate: parseFloat(gstInputs[i].value) || 0
        });
      }

      var payload = {
        lot_id: lot.lot_id,
        items: itemPayloads,
        transport_paise: Math.round((parseFloat(document.getElementById('srf-transport').value) || 0) * 100),
        loading_paise: Math.round((parseFloat(document.getElementById('srf-loading').value) || 0) * 100),
        other_paise: Math.round((parseFloat(document.getElementById('srf-other').value) || 0) * 100),
        gst_in_cost: document.getElementById('srf-gst-cost').checked
      };

      window.ui.withButtonLoading(submitBtn, async function() {
        try {
          await window.api.call('lots.setRates', payload);
          window.ui.closeBottomSheet();
          window.ui.toast('Rates finalized successfully', 'success');
          loadLots();
        } catch(err) {
          errEl.textContent = err.message || 'Operation failed';
          errEl.style.display = 'block';
        }
      });
    };
  }

  // ---------------------------------------------------------------------------
  // Lot Intake / Create Form (Owner & Manager Modes)
  // ---------------------------------------------------------------------------
  newBtn.onclick = function() {
    openCreateLotForm();
  };

  function openCreateLotForm() {
    var lineItems = [];

    var canEnterAmounts = isOwner || (window.auth.getUser() && window.auth.getUser().role === 'MANAGER');

    function renderLines() {
      var linesContainer = document.getElementById('clf-lines-container');
      if (!linesContainer) return;

      if (!lineItems.length) {
        linesContainer.innerHTML = '<p class="text-muted" style="text-align:center; padding:1rem 0; font-size:0.875rem;">No items added yet. Click "+ Add Line Item" below.</p>';
        return;
      }

      linesContainer.innerHTML = lineItems.map(function(item, idx) {
        var prd = products.find(function(p) { return p.product_id === item.product_id; });
        var prdName = prd ? prd.name : item.product_id;
        var hasSerials = prd && prd.track_serial;

        return `
          <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:0.75rem; margin-bottom:0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>${window.ui.esc(prdName)}</strong>
              <button type="button" class="btn btn-secondary clf-del-item" data-idx="${idx}" style="min-height:36px; padding:0.25rem 0.5rem; color:var(--danger, #dc2626);">&times;</button>
            </div>
            <div style="display:flex; gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap;">
              <div style="flex:1; min-width:80px;">
                <label style="font-size:0.75rem;">Qty</label>
                <input type="number" class="input clf-qty" data-idx="${idx}" value="${item.qty}" min="1" required>
              </div>
              ${canEnterAmounts ? `
                <div style="flex:2; min-width:100px;">
                  <label style="font-size:0.75rem;">Rate (₹)</label>
                  <input type="number" step="0.01" class="input clf-rate" data-idx="${idx}" value="${item.rate || ''}" placeholder="Rate">
                </div>
                <div style="flex:1; min-width:70px;">
                  <label style="font-size:0.75rem;">GST %</label>
                  <input type="number" class="input clf-gst" data-idx="${idx}" value="${item.gst_rate !== undefined ? item.gst_rate : 12}">
                </div>
              ` : ''}
            </div>
            ${hasSerials ? `
              <div style="margin-top:0.5rem;">
                <button type="button" class="btn btn-secondary clf-serial-btn" data-idx="${idx}" style="min-height:36px; font-size:0.8rem; width:100%;">
                  Serials: ${item.serials.length} / ${item.qty}
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      linesContainer.querySelectorAll('.clf-del-item').forEach(function(btn) {
        btn.onclick = function() {
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          lineItems.splice(idx, 1);
          renderLines();
        };
      });

      linesContainer.querySelectorAll('.clf-qty').forEach(function(input) {
        input.onchange = function() {
          var idx = parseInt(input.getAttribute('data-idx'), 10);
          lineItems[idx].qty = parseInt(input.value, 10) || 1;
          renderLines();
        };
      });

      if (canEnterAmounts) {
        linesContainer.querySelectorAll('.clf-rate').forEach(function(input) {
          input.onchange = function() {
            var idx = parseInt(input.getAttribute('data-idx'), 10);
            lineItems[idx].rate = parseFloat(input.value) || 0;
          };
        });
        linesContainer.querySelectorAll('.clf-gst').forEach(function(input) {
          input.onchange = function() {
            var idx = parseInt(input.getAttribute('data-idx'), 10);
            lineItems[idx].gst_rate = parseFloat(input.value) || 12;
          };
        });
      }

      linesContainer.querySelectorAll('.clf-serial-btn').forEach(function(btn) {
        btn.onclick = function() {
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          var line = lineItems[idx];
          window.serialInput.open({
            expectedQty: line.qty,
            initialSerials: line.serials,
            onConfirm: function(serialsList) {
              line.serials = serialsList;
              renderLines();
            }
          });
        };
      });
    }

    var formHtml = `
      <form id="create-lot-form" novalidate>
        <div class="form-field">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <label style="margin-bottom:0;">Supplier *</label>
            <button type="button" id="clf-new-supp-btn" class="btn btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; min-height:28px;">+ New Supplier</button>
          </div>
          <select id="clf-supplier" class="input" required>
            <option value="">Select Supplier</option>
            ${suppliers.map(function(s) { return `<option value="${s.supplier_id}">${window.ui.esc(s.name)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Invoice Number *</label>
          <input type="text" id="clf-invoice" class="input" placeholder="e.g. INV-2026-001" required>
        </div>
        <div class="form-field">
          <label>Godown / Location *</label>
          <select id="clf-location" class="input" required>
            ${locations.map(function(l) { return `<option value="${l.location_id}">${window.ui.esc(l.name)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Invoice Date</label>
          <input type="date" id="clf-date" class="input" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-field">
          <label>${window.ui.esc(t('lots.order_status'))}</label>
          <select id="clf-order-status" class="input">
            <option value="DELIVERED" selected>DELIVERED (Immediate Stock)</option>
            <option value="ORDER_CONFIRMED">ORDER CONFIRMED (Pending Delivery)</option>
            <option value="DISPATCHED">DISPATCHED (In Transit)</option>
          </select>
        </div>

        <div style="margin:1rem 0 0.5rem 0; font-weight:700;">Line Items:</div>
        <div id="clf-lines-container"></div>
        <button type="button" id="clf-add-line-btn" class="btn btn-secondary btn-full" style="margin-bottom:1rem;">+ Add Line Item</button>

        ${canEnterAmounts ? `
          <div class="form-field">
            <label>Transport / Freight (₹)</label>
            <input type="number" step="0.01" id="clf-transport" class="input" value="0">
          </div>
          <div class="form-field">
            <label>Loading / Extra (₹)</label>
            <input type="number" step="0.01" id="clf-loading" class="input" value="0">
          </div>
          <div class="form-field">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" id="clf-gst-cost">
              <span>Include GST in Cost</span>
            </label>
          </div>
        ` : ''}

        <div id="clf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="clf-submit" class="btn btn-primary btn-full">Submit Lot Intake</button>
      </form>
    `;

    window.ui.openBottomSheet('Inward Purchase Lot', formHtml, '');
    renderLines();

    var newSuppBtn = document.getElementById('clf-new-supp-btn');
    if (newSuppBtn) {
      newSuppBtn.onclick = function() {
        var suppFormHtml = `
          <form id="inline-supp-form" novalidate>
            <div class="form-field">
              <label>Supplier Name *</label>
              <input type="text" id="isf-name" class="input" required placeholder="e.g. Adani Solar Ltd">
            </div>
            <div class="form-field">
              <label>GST Number</label>
              <input type="text" id="isf-gst" class="input" placeholder="e.g. 24AAAAA0000A1Z5">
            </div>
            <div class="form-field">
              <label>Phone Number</label>
              <input type="tel" id="isf-phone" class="input" placeholder="e.g. 9876543210">
            </div>
            <div class="form-field">
              <label>Address</label>
              <textarea id="isf-address" class="input" rows="2" placeholder="Full address"></textarea>
            </div>
            <div id="isf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
            <button type="submit" id="isf-submit" class="btn btn-primary btn-full">Save Supplier</button>
          </form>
        `;

        window.ui.openBottomSheet('New Supplier', suppFormHtml, '');

        document.getElementById('inline-supp-form').onsubmit = async function(ev) {
          ev.preventDefault();
          var errEl2 = document.getElementById('isf-error');
          var submitBtn2 = document.getElementById('isf-submit');
          errEl2.style.display = 'none';

          var sName = document.getElementById('isf-name').value.trim();
          var sGst = document.getElementById('isf-gst').value.trim();
          var sPhone = document.getElementById('isf-phone').value.trim();
          var sAddress = document.getElementById('isf-address').value.trim();

          if (!sName) {
            errEl2.textContent = 'Name is required';
            errEl2.style.display = 'block';
            return;
          }

          window.ui.withButtonLoading(submitBtn2, async function() {
            try {
              var newSup = await window.api.call('suppliers.create', {
                name: sName,
                gst_no: sGst,
                phone: sPhone,
                address: sAddress
              });

              var select = document.getElementById('clf-supplier');
              if (select && newSup && newSup.supplier_id) {
                suppliers.push(newSup);
                var opt = document.createElement('option');
                opt.value = newSup.supplier_id;
                opt.textContent = newSup.name;
                select.appendChild(opt);
                select.value = newSup.supplier_id;
              }

              window.ui.closeBottomSheet();
              window.ui.toast('Supplier created', 'success');
            } catch(err) {
              errEl2.textContent = err.message || 'Failed to create supplier';
              errEl2.style.display = 'block';
            }
          });
        };
      };
    }

    document.getElementById('clf-add-line-btn').onclick = function() {
      window.searchSelect.open({
        title: 'Select Product',
        items: products,
        placeholder: 'Search product…',
        getLabel: function(p) { return p.name; },
        getSub: function(p) { return [p.category, p.brand, p.model].filter(Boolean).join(' · '); },
        onSelect: function(p) {
          lineItems.push({
            product_id: p.product_id,
            qty: 1,
            rate: 0,
            gst_rate: p.default_gst_rate || 12,
            serials: []
          });
          renderLines();
        }
      });
    };

    document.getElementById('create-lot-form').onsubmit = async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('clf-error');
      var submitBtn = document.getElementById('clf-submit');
      errEl.style.display = 'none';

      var supId = document.getElementById('clf-supplier').value;
      var invNo = document.getElementById('clf-invoice').value.trim();
      var locId = document.getElementById('clf-location').value;
      var lotDate = document.getElementById('clf-date').value;

      if (!supId) {
        errEl.textContent = 'Supplier is required';
        errEl.style.display = 'block';
        return;
      }
      if (!invNo) {
        errEl.textContent = 'Invoice number is required';
        errEl.style.display = 'block';
        return;
      }
      if (!lineItems.length) {
        errEl.textContent = 'At least one line item is required';
        errEl.style.display = 'block';
        return;
      }

      var itemsPayload = lineItems.map(function(it) {
        var res = {
          product_id: it.product_id,
          qty: it.qty,
          serials: it.serials
        };
        if (canEnterAmounts && it.rate !== undefined && it.rate !== '') {
          res.rate_paise = Math.round((parseFloat(it.rate) || 0) * 100);
          res.gst_rate = parseFloat(it.gst_rate) || 0;
        }
        return res;
      });

      var orderStatusVal = document.getElementById('clf-order-status') ? document.getElementById('clf-order-status').value : 'DELIVERED';

      var payload = {
        supplier_id: supId,
        invoice_no: invNo,
        location_id: locId,
        lot_date: lotDate,
        order_status: orderStatusVal,
        items: itemsPayload
      };

      if (canEnterAmounts) {
        var tEl = document.getElementById('clf-transport');
        if (tEl && tEl.value !== '') payload.transport_paise = Math.round((parseFloat(tEl.value) || 0) * 100);
        var lEl = document.getElementById('clf-loading');
        if (lEl && lEl.value !== '') payload.loading_paise = Math.round((parseFloat(lEl.value) || 0) * 100);
        var gEl = document.getElementById('clf-gst-cost');
        if (gEl) payload.gst_in_cost = gEl.checked;
      }

      window.ui.withButtonLoading(submitBtn, async function() {
        try {
          await window.api.call('lots.create', payload);
          window.ui.closeAllBottomSheets();
          window.ui.toast('Purchase lot recorded successfully', 'success');
          loadLots();
        } catch(err) {
          if (err && (err.code === 'SCHEMA_OUT_OF_DATE' || (err.message && err.message.indexOf('SCHEMA_OUT_OF_DATE') !== -1))) {
            errEl.innerHTML = (window.ui.esc(err.message || 'Database schema is out of date.')) +
              '<div style="margin-top:0.5rem;"><button type="button" class="btn btn-sm btn-primary" id="btn-err-migrate-schema">Update Database Columns</button></div>';
            errEl.style.display = 'block';
            var mBtn = errEl.querySelector('#btn-err-migrate-schema');
            if (mBtn) {
              mBtn.onclick = async function() {
                try {
                  await window.api.call('system.migrateSchema', {});
                  window.ui.toast('Database columns updated! Retrying...', 'success');
                  submitBtn.click();
                } catch(mErr) {
                  window.ui.toast(mErr.message || 'Migration failed', 'error');
                }
              };
            }
          } else {
            errEl.textContent = err.message || 'Failed to create lot';
            errEl.style.display = 'block';
          }
        }
      });
    };
  }

  await loadLots();
};
