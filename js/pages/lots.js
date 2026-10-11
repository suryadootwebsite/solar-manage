/**
 * lots.js — Purchase Lots Entry and Management Screen (Doc 06 S13, S14).
 * Accessible by OWNER (full financials) and MANAGER (qty-only / PENDING_RATE).
 */

window.pages = window.pages || {};

window.pages.lots = async function(container) {
  var t = window.i18n.t;
  var isOwner = window.auth.getUser() && window.auth.getUser().role === 'OWNER';

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
      <div>
        <h2 style="margin:0;">${window.ui.esc(t('lots.title'))}</h2>
        <p class="text-muted" style="margin:0.25rem 0 0; font-size:0.875rem;">${window.ui.esc(t('lots.subtitle'))}</p>
      </div>
      <button id="lot-new-btn" class="btn btn-primary" style="min-height:44px;">+ ${window.ui.esc(t('lots.new_btn'))}</button>
    </div>

    <!-- Filter chips -->
    <div style="display:flex; gap:0.5rem; margin-bottom:1rem; overflow-x:auto; padding-bottom:0.25rem;">
      <button class="btn btn-secondary lot-filter-btn active" data-status="">All</button>
      <button class="btn btn-secondary lot-filter-btn" data-status="CONFIRMED">CONFIRMED</button>
      <button class="btn btn-secondary lot-filter-btn" data-status="PENDING_RATE">PENDING RATE</button>
      <button class="btn btn-secondary lot-filter-btn" data-status="CANCELLED">CANCELLED</button>
    </div>

    <div id="lot-list-view">
      <div style="text-align:center; padding:2rem 0;"><span class="spinner"></span></div>
    </div>
  `;

  var listView = document.getElementById('lot-list-view');
  var newBtn = document.getElementById('lot-new-btn');
  var filterButtons = container.querySelectorAll('.lot-filter-btn');

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

  function renderLots() {
    if (!lots.length) {
      listView.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:2rem 1rem;">${window.ui.esc(t('lots.empty'))}</div>`;
      return;
    }

    listView.innerHTML = lots.map(function(l) {
      var statusClass = l.status === 'CONFIRMED' ? 'badge-success' : (l.status === 'PENDING_RATE' ? 'badge-warning' : 'badge-disabled');
      var totalText = isOwner && l.grand_total_paise !== undefined ? `₹${(l.grand_total_paise / 100).toLocaleString('en-IN')}` : '';

      return `
        <div class="card lot-card" data-id="${l.lot_id}" style="margin-bottom:0.75rem; cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:700; font-size:1.05rem; color:var(--text-main);">
                ${window.ui.esc(getSupplierName(l.supplier_id))}
              </div>
              <div style="font-size:0.875rem; color:var(--text-muted); margin-top:0.25rem;">
                Inv: <strong>${window.ui.esc(l.invoice_no)}</strong> · Date: ${window.ui.esc(l.lot_date)}
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
                📍 ${window.ui.esc(getLocationName(l.location_id))}
              </div>
            </div>
            <div style="text-align:right;">
              <span class="badge ${statusClass}">${l.status}</span>
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
          ${isOwner && lot.grand_total_paise !== undefined ? `
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; color:var(--brand); font-weight:bold;">
              <span>Grand Total:</span>
              <span>₹${(lot.grand_total_paise / 100).toLocaleString('en-IN')}</span>
            </div>
          ` : ''}
        </div>
        <div style="font-weight:700; margin-bottom:0.5rem;">Line Items:</div>
        <div style="margin-bottom:1.5rem;">
          ${itemsHtml}
        </div>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          ${canSetRate ? `<button id="lot-set-rate-btn" class="btn btn-primary btn-full">Set Rates (Back-fill)</button>` : ''}
          ${canCancel ? `<button id="lot-cancel-btn" class="btn btn-secondary btn-full" style="color:var(--danger, #dc2626);">Cancel Lot</button>` : ''}
        </div>
      `;

      window.ui.openBottomSheet('Purchase Lot: ' + lot.lot_id, bodyHtml, '');

      if (canSetRate) {
        document.getElementById('lot-set-rate-btn').onclick = function() {
          window.ui.closeBottomSheet();
          openSetRatesForm(lot, items);
        };
      }

      if (canCancel) {
        document.getElementById('lot-cancel-btn').onclick = function() {
          window.ui.confirmDialog(
            'Cancel Lot',
            'Are you sure you want to cancel lot ' + lot.invoice_no + '? Stock will be voided.',
            async function() {
              try {
                await window.api.call('lots.cancel', { lot_id: lot.lot_id, reason: 'Cancelled by user' });
                window.ui.toast('Lot cancelled', 'success');
                loadLots();
              } catch(e) {
                window.ui.toast(e.message || 'Cancel failed', 'error');
              }
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
  // Set Rates Form (Owner Back-fill)
  // ---------------------------------------------------------------------------
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

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Saving…';

      try {
        await window.api.call('lots.setRates', payload);
        window.ui.closeBottomSheet();
        window.ui.toast('Rates finalized successfully', 'success');
        loadLots();
      } catch(err) {
        errEl.textContent = err.message || 'Operation failed';
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save & Finalize Rates';
      }
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
              ${isOwner ? `
                <div style="flex:2; min-width:100px;">
                  <label style="font-size:0.75rem;">Rate (₹)</label>
                  <input type="number" step="0.01" class="input clf-rate" data-idx="${idx}" value="${item.rate || ''}" placeholder="Rate" required>
                </div>
                <div style="flex:1; min-width:70px;">
                  <label style="font-size:0.75rem;">GST %</label>
                  <input type="number" class="input clf-gst" data-idx="${idx}" value="${item.gst_rate || 12}">
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

      if (isOwner) {
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
          <label>Supplier *</label>
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

        <div style="margin:1rem 0 0.5rem 0; font-weight:700;">Line Items:</div>
        <div id="clf-lines-container"></div>
        <button type="button" id="clf-add-line-btn" class="btn btn-secondary btn-full" style="margin-bottom:1rem;">+ Add Line Item</button>

        ${isOwner ? `
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
        if (isOwner) {
          res.rate_paise = Math.round((parseFloat(it.rate) || 0) * 100);
          res.gst_rate = parseFloat(it.gst_rate) || 0;
        }
        return res;
      });

      var payload = {
        supplier_id: supId,
        invoice_no: invNo,
        location_id: locId,
        lot_date: lotDate,
        items: itemsPayload
      };

      if (isOwner) {
        payload.transport_paise = Math.round((parseFloat(document.getElementById('clf-transport').value) || 0) * 100);
        payload.loading_paise = Math.round((parseFloat(document.getElementById('clf-loading').value) || 0) * 100);
        payload.gst_in_cost = document.getElementById('clf-gst-cost').checked;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Processing…';

      try {
        await window.api.call('lots.create', payload);
        window.ui.closeBottomSheet();
        window.ui.toast('Purchase lot recorded successfully', 'success');
        loadLots();
      } catch(err) {
        errEl.textContent = err.message || 'Failed to create lot';
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Lot Intake';
      }
    };
  }

  await loadLots();
};
