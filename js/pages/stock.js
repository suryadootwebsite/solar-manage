/**
 * stock.js — Stock Overview, Batches, and Physical Adjustment Screen (Doc 06 S09, S10).
 */

window.pages = window.pages || {};

window.pages.stock = async function(container) {
  var t = window.i18n.t;
  var isOwner = window.auth.getUser() && window.auth.getUser().role === 'OWNER';

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
      <div>
        <h2 style="margin:0;">${window.ui.esc(t('stock.title'))}</h2>
        <p class="text-muted" style="margin:0.25rem 0 0; font-size:0.875rem;">${window.ui.esc(t('stock.subtitle'))}</p>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button id="stk-transfer-nav-btn" class="btn btn-secondary" style="min-height:44px;">Transfers</button>
        <button id="stk-adjust-btn" class="btn btn-primary" style="min-height:44px;">Adjust Stock</button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div style="display:flex; gap:0.5rem; margin-bottom:1rem; flex-wrap:wrap;">
      <input type="text" id="stk-search" class="input" style="flex:2; min-width:180px;" placeholder="Search product…">
      <select id="stk-loc-filter" class="input" style="flex:1; min-width:140px;">
        <option value="">All Godowns</option>
      </select>
      <button id="stk-low-toggle" class="btn btn-secondary" style="min-height:44px;">Low Stock Only</button>
    </div>

    <div id="stk-list-view">
      <div style="text-align:center; padding:2rem 0;"><span class="spinner"></span></div>
    </div>
  `;

  var listView = document.getElementById('stk-list-view');
  var searchInput = document.getElementById('stk-search');
  var locFilter = document.getElementById('stk-loc-filter');
  var lowToggle = document.getElementById('stk-low-toggle');
  var adjustBtn = document.getElementById('stk-adjust-btn');
  var transferNavBtn = document.getElementById('stk-transfer-nav-btn');

  var locations = [];
  var products = [];
  var stockItems = [];
  var lowOnly = false;

  transferNavBtn.onclick = function() {
    window.location.hash = '#/transfers';
  };

  // Load locations and products for filter dropdowns
  try {
    var [locRes, prdRes] = await Promise.all([
      window.api.call('locations.list', {}),
      window.api.call('products.list', {})
    ]);
    locations = locRes.items || [];
    products = prdRes.items || [];
    locations.forEach(function(l) {
      var opt = document.createElement('option');
      opt.value = l.location_id;
      opt.textContent = l.name;
      locFilter.appendChild(opt);
    });
  } catch(e) {
    console.warn('Could not load filters', e);
  }

  function getLocationName(id) {
    var l = locations.find(function(x) { return x.location_id === id; });
    return l ? l.name : id;
  }

  async function loadStock() {
    try {
      var payload = {};
      if (locFilter.value) payload.location_id = locFilter.value;
      if (lowOnly) payload.low_only = true;
      var res = await window.api.call('stock.summary', payload);
      stockItems = res.items || [];
      renderStock();
    } catch(err) {
      listView.innerHTML = `<div class="card text-error" style="text-align:center;">${window.ui.esc(err.message || 'Failed to load stock')}</div>`;
    }
  }

  function renderStock() {
    var q = (searchInput.value || '').toLowerCase().trim();
    var filtered = stockItems.filter(function(it) {
      if (!q) return true;
      return (it.product_name || '').toLowerCase().indexOf(q) >= 0 ||
             (it.category || '').toLowerCase().indexOf(q) >= 0 ||
             (it.brand || '').toLowerCase().indexOf(q) >= 0;
    });

    if (!filtered.length) {
      listView.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:2rem 1rem;">No stock items match filter.</div>`;
      return;
    }

    listView.innerHTML = filtered.map(function(s) {
      var lowBadge = s.low_stock ? `<span class="badge badge-warning" style="margin-left:0.5rem;">LOW STOCK</span>` : '';
      var inTransitBadge = s.in_transit_qty > 0 ? `<span class="badge" style="background:#e0f2fe; color:#0369a1; margin-left:0.5rem;">In Transit: ${s.in_transit_qty}</span>` : '';
      var valText = isOwner && s.value_paise !== undefined ? `₹${(s.value_paise / 100).toLocaleString('en-IN')}` : '';

      return `
        <div class="card stk-card" data-pid="${s.product_id}" data-lid="${s.location_id}" style="margin-bottom:0.75rem; cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:700; font-size:1.05rem; color:var(--text-main);">
                ${window.ui.esc(s.product_name)} ${lowBadge} ${inTransitBadge}
              </div>
              <div style="font-size:0.875rem; color:var(--text-muted); margin-top:0.25rem;">
                📍 Godown: <strong>${window.ui.esc(getLocationName(s.location_id))}</strong> · Category: ${window.ui.esc(s.category)}
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
                Available: <strong style="font-size:1rem; color:var(--brand);">${s.qty} ${window.ui.esc(s.unit || 'nos')}</strong>
                ${s.track_serial && s.serial_pending > 0 ? `· Pending Serials: <span style="color:var(--danger, #dc2626); font-weight:bold;">${s.serial_pending}</span>` : ''}
              </div>
            </div>
            ${valText ? `
              <div style="text-align:right;">
                <div style="font-size:0.8rem; color:var(--text-muted);">Valuation</div>
                <div style="font-weight:700; color:var(--text-main);">${valText}</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    listView.querySelectorAll('.stk-card').forEach(function(card) {
      card.onclick = function() {
        var pid = card.getAttribute('data-pid');
        var lid = card.getAttribute('data-lid');
        openBatchBreakdown(pid, lid);
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Batch Breakdown Bottom Sheet
  // ---------------------------------------------------------------------------
  async function openBatchBreakdown(productId, locationId) {
    window.ui.showSpinner();
    try {
      var res = await window.api.call('stock.batches', { product_id: productId, location_id: locationId });
      var batches = res.batches || [];
      window.ui.hideSpinner();

      var prd = products.find(function(p) { return p.product_id === productId; });
      var prdName = prd ? prd.name : productId;

      var batchesHtml = batches.map(function(b) {
        var costInfo = isOwner && b.landed_unit_paise ? `· Unit Cost: ₹${(b.landed_unit_paise / 100).toFixed(2)}` : '';
        return `
          <div style="padding:0.75rem; background:var(--bg-card); border-radius:6px; margin-bottom:0.5rem; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; font-weight:600;">
              <span>Batch: ${window.ui.esc(b.batch_id)}</span>
              <span style="color:var(--brand);">${b.qty_remaining} units</span>
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
              Received: ${window.ui.esc(b.received_date)} ${costInfo}
            </div>
            ${b.serial_pending > 0 ? `<div style="font-size:0.8rem; color:var(--danger, #dc2626); margin-top:0.25rem;">⚠️ Serials pending: ${b.serial_pending}</div>` : ''}
          </div>
        `;
      }).join('');

      var bodyHtml = `
        <p class="text-muted" style="margin:0 0 1rem 0;">Location: <strong>${window.ui.esc(getLocationName(locationId))}</strong></p>
        <div>${batchesHtml || '<p class="text-muted">No open batches.</p>'}</div>
      `;

      window.ui.openBottomSheet('Batches: ' + prdName, bodyHtml, '');
    } catch(err) {
      window.ui.hideSpinner();
      window.ui.toast(err.message || 'Failed to get batches', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Quick Stock Adjustment Dialog
  // ---------------------------------------------------------------------------
  adjustBtn.onclick = function() {
    openAdjustDialog();
  };

  function openAdjustDialog() {
    var formHtml = `
      <form id="adjust-form" novalidate>
        <div class="form-field">
          <label>Product *</label>
          <select id="adj-product" class="input" required>
            <option value="">Select Product</option>
            ${products.map(function(p) { return `<option value="${p.product_id}">${window.ui.esc(p.name)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Godown / Location *</label>
          <select id="adj-location" class="input" required>
            <option value="">Select Location</option>
            ${locations.map(function(l) { return `<option value="${l.location_id}">${window.ui.esc(l.name)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Direction *</label>
          <select id="adj-direction" class="input" required>
            <option value="MINUS">Deduct Stock (MINUS / Loss / Damage)</option>
            ${isOwner ? '<option value="PLUS">Add Stock (PLUS / Surplus Found)</option>' : ''}
          </select>
        </div>
        <div class="form-field">
          <label>Quantity *</label>
          <input type="number" id="adj-qty" class="input" min="1" required>
        </div>
        <div class="form-field">
          <label>Reason *</label>
          <input type="text" id="adj-reason" class="input" placeholder="e.g. Physical audit recount, Damaged in warehouse" required>
        </div>
        <div id="adj-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="adj-submit" class="btn btn-primary btn-full">Apply Adjustment</button>
      </form>
    `;

    window.ui.openBottomSheet('Adjust Stock Count', formHtml, '');

    document.getElementById('adjust-form').onsubmit = async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('adj-error');
      var submitBtn = document.getElementById('adj-submit');
      errEl.style.display = 'none';

      var payload = {
        product_id:  document.getElementById('adj-product').value,
        location_id: document.getElementById('adj-location').value,
        direction:   document.getElementById('adj-direction').value,
        qty:         parseInt(document.getElementById('adj-qty').value, 10),
        reason:      document.getElementById('adj-reason').value.trim()
      };

      if (!payload.product_id || !payload.location_id || !payload.qty || !payload.reason) {
        errEl.textContent = 'Please fill all required fields';
        errEl.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Applying…';

      try {
        await window.api.call('stock.adjust', payload);
        window.ui.closeBottomSheet();
        window.ui.toast('Stock adjusted successfully', 'success');
        loadStock();
      } catch(err) {
        errEl.textContent = err.message || 'Adjustment failed';
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Apply Adjustment';
      }
    };
  }

  lowToggle.onclick = function() {
    lowOnly = !lowOnly;
    if (lowOnly) {
      lowToggle.classList.remove('btn-secondary');
      lowToggle.classList.add('btn-primary');
    } else {
      lowToggle.classList.remove('btn-primary');
      lowToggle.classList.add('btn-secondary');
    }
    loadStock();
  };

  locFilter.onchange = loadStock;
  searchInput.oninput = renderStock;

  await loadStock();
};
