/**
 * transfers.js — Inter-Location Stock Transfer Management Screen (Doc 06 S11, S12).
 */

window.pages = window.pages || {};

window.pages.transfers = async function(container) {
  var t = window.i18n.t;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
      <div>
        <h2 style="margin:0;">Stock Transfers</h2>
        <p class="text-muted" style="margin:0.25rem 0 0; font-size:0.875rem;">Move inventory between warehouses and godowns</p>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button id="trf-back-stk-btn" class="btn btn-secondary" style="min-height:44px;">&larr; Stock</button>
        <button id="trf-new-btn" class="btn btn-primary" style="min-height:44px;">+ New Transfer</button>
      </div>
    </div>

    <div id="trf-search-mount"></div>
    <!-- Filter chips -->
    <div style="display:flex; gap:0.5rem; margin-bottom:1rem; overflow-x:auto;">
      <button class="btn btn-primary trf-filter-btn active" data-status="">All</button>
      <button class="btn btn-secondary trf-filter-btn" data-status="IN_TRANSIT">In-Transit</button>
      <button class="btn btn-secondary trf-filter-btn" data-status="RECEIVED">Received</button>
      <button class="btn btn-secondary trf-filter-btn" data-status="CANCELLED">Cancelled</button>
    </div>

    <div id="trf-list-view">
      <div style="text-align:center; padding:2rem 0;"><span class="spinner"></span></div>
    </div>
  `;

  var listView = document.getElementById('trf-list-view');
  var newBtn = document.getElementById('trf-new-btn');
  var backBtn = document.getElementById('trf-back-stk-btn');
  var filterButtons = container.querySelectorAll('.trf-filter-btn');

  var trfSearchQuery = "";
  if (window.components && window.components.createSearchBar) {
    var sBar = window.components.createSearchBar({
      placeholder: "Search transfer ID, location, status...",
      onSearch: function(q) {
        trfSearchQuery = q;
        renderTransfers();
      }
    });
    var tm = document.getElementById("trf-search-mount");
    if (tm) tm.appendChild(sBar.element);
  }

  var currentStatus = '';
  var transfers = [];
  var locations = [];
  var products = [];

  backBtn.onclick = function() {
    window.location.hash = '#/stock';
  };

  try {
    var [locRes, prdRes] = await Promise.all([
      window.api.call('locations.list', {}),
      window.api.call('products.list', {})
    ]);
    locations = locRes.items || [];
    products = prdRes.items || [];
  } catch(e) {
    console.warn('Could not load locations/products', e);
  }

  function getLocationName(id) {
    var l = locations.find(function(x) { return x.location_id === id; });
    return l ? l.name : id;
  }

  async function loadTransfers() {
    try {
      var payload = {};
      if (currentStatus) payload.status = currentStatus;
      var res = await window.api.call('stock.transfer.list', payload);
      transfers = res.items || [];
      renderTransfers();
    } catch(err) {
      listView.innerHTML = `<div class="card text-error" style="text-align:center;">${window.ui.esc(err.message || 'Failed to load transfers')}</div>`;
    }
  }

  function renderTransfers() {
    var displayTransfers = transfers;
    if (trfSearchQuery && window.components && window.components.filterListByQuery) {
      displayTransfers = window.components.filterListByQuery(transfers, trfSearchQuery, ['transfer_id', 'from_location_id', 'to_location_id', 'status']);
    }
    if (!displayTransfers.length) {
      listView.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:2rem 1rem;">No stock transfers found.</div>`;
      return;
    }

    listView.innerHTML = displayTransfers.map(function(t) {
      var statusClass = t.status === 'RECEIVED' ? 'badge-success' : (t.status === 'IN_TRANSIT' ? 'badge-warning' : 'badge-disabled');

      return `
        <div class="card trf-card" data-id="${t.transfer_id}" style="margin-bottom:0.75rem; cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:700; font-size:1.05rem; color:var(--text-main);">
                ${window.ui.esc(getLocationName(t.from_location_id))} &rarr; ${window.ui.esc(getLocationName(t.to_location_id))}
              </div>
              <div style="font-size:0.875rem; color:var(--text-muted); margin-top:0.25rem;">
                ID: <strong>${t.transfer_id}</strong> · Dispatched: ${window.ui.esc(t.dispatch_date)}
              </div>
              ${t.receive_date ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">Received: ${window.ui.esc(t.receive_date)}</div>` : ''}
            </div>
            <span class="badge ${statusClass}">${t.status}</span>
          </div>
        </div>
      `;
    }).join('');

    listView.querySelectorAll('.trf-card').forEach(function(card) {
      card.onclick = function() {
        var id = card.getAttribute('data-id');
        openTransferDetail(id);
      };
    });
  }

  filterButtons.forEach(function(btn) {
    btn.onclick = function() {
      filterButtons.forEach(function(b) { b.classList.remove('active', 'btn-primary'); b.classList.add('btn-secondary'); });
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-secondary');
      currentStatus = btn.getAttribute('data-status');
      loadTransfers();
    };
  });

  // ---------------------------------------------------------------------------
  // Transfer Detail & Receive / Cancel Actions
  // ---------------------------------------------------------------------------
  async function openTransferDetail(transferId) {
    window.ui.showSpinner();
    try {
      var res = await window.api.call('stock.transfer.get', { transfer_id: transferId });
      var transfer = res.transfer;
      var items = res.items || [];
      window.ui.hideSpinner();

      var itemsHtml = items.map(function(it) {
        var prd = products.find(function(p) { return p.product_id === it.product_id; });
        return `
          <div style="padding:0.5rem 0; border-bottom:1px solid var(--border);">
            <div style="font-weight:600;">${window.ui.esc(prd ? prd.name : it.product_id)}</div>
            <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
              Sent: <strong>${it.qty_sent}</strong> ${it.qty_received ? `· Received: <strong>${it.qty_received}</strong>` : ''}
            </div>
          </div>
        `;
      }).join('');

      var isPending = transfer.status === 'IN_TRANSIT';

      var bodyHtml = `
        <div style="margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span>From Location:</span>
            <strong>${window.ui.esc(getLocationName(transfer.from_location_id))}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span>To Location:</span>
            <strong>${window.ui.esc(getLocationName(transfer.to_location_id))}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span>Status:</span>
            <strong>${transfer.status}</strong>
          </div>
        </div>
        <div style="font-weight:700; margin-bottom:0.5rem;">Transfer Items:</div>
        <div style="margin-bottom:1.5rem;">
          ${itemsHtml}
        </div>
        ${isPending ? `
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <button id="trfd-receive-btn" class="btn btn-primary btn-full">Confirm Receipt at Destination</button>
            <button id="trfd-cancel-btn" class="btn btn-secondary btn-full" style="color:var(--danger, #dc2626);">Cancel Transfer</button>
          </div>
        ` : ''}
      `;

      window.ui.openBottomSheet('Transfer: ' + transfer.transfer_id, bodyHtml, '');

      if (isPending) {
        var recBtn = document.getElementById('trfd-receive-btn');
        recBtn.onclick = function() {
          window.ui.withButtonLoading(recBtn, async function() {
            try {
              await window.api.call('stock.transfer.receive', { transfer_id: transfer.transfer_id });
              window.ui.closeBottomSheet();
              window.ui.toast('Transfer received successfully', 'success');
              loadTransfers();
            } catch(err) {
              window.ui.toast(err.message || 'Receive failed', 'error');
            }
          });
        };

        var cancelBtn = document.getElementById('trfd-cancel-btn');
        cancelBtn.onclick = function() {
          window.ui.confirmDialog(
            'Cancel Transfer',
            'Are you sure you want to cancel transfer ' + transfer.transfer_id + '? Stock will be returned to source location.',
            function() {
              window.ui.withButtonLoading(cancelBtn, async function() {
                try {
                  await window.api.call('stock.transfer.cancel', { transfer_id: transfer.transfer_id, reason: 'Cancelled by operator' });
                  window.ui.toast('Transfer cancelled', 'success');
                  loadTransfers();
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
      window.ui.toast(err.message || 'Failed to get transfer', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Create New Transfer Dialog
  // ---------------------------------------------------------------------------
  newBtn.onclick = function() {
    openCreateTransferDialog();
  };

  function openCreateTransferDialog() {
    var formHtml = `
      <form id="create-trf-form" novalidate>
        <div class="form-field">
          <label>Source Godown *</label>
          <select id="ctf-from" class="input" required>
            <option value="">Select Origin</option>
            ${locations.map(function(l) { return `<option value="${l.location_id}">${window.ui.esc(l.name)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Destination Godown *</label>
          <select id="ctf-to" class="input" required>
            <option value="">Select Destination</option>
            ${locations.map(function(l) { return `<option value="${l.location_id}">${window.ui.esc(l.name)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Product *</label>
          <select id="ctf-product" class="input" required>
            <option value="">Select Product</option>
            ${products.map(function(p) { return `<option value="${p.product_id}">${window.ui.esc(p.name)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Quantity to Transfer *</label>
          <input type="number" id="ctf-qty" class="input" min="1" required>
        </div>
        <div class="form-field">
          <label>Remark / Notes</label>
          <input type="text" id="ctf-remark" class="input" placeholder="e.g. Project dispatch transfer">
        </div>
        <div id="ctf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="ctf-submit" class="btn btn-primary btn-full">Dispatch Transfer</button>
      </form>
    `;

    window.ui.openBottomSheet('Dispatch Stock Transfer', formHtml, '');

    document.getElementById('create-trf-form').onsubmit = async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('ctf-error');
      var submitBtn = document.getElementById('ctf-submit');
      errEl.style.display = 'none';

      var fromLoc = document.getElementById('ctf-from').value;
      var toLoc = document.getElementById('ctf-to').value;
      var prdId = document.getElementById('ctf-product').value;
      var qty = parseInt(document.getElementById('ctf-qty').value, 10);
      var remark = document.getElementById('ctf-remark').value.trim();

      if (!fromLoc || !toLoc || !prdId || !qty) {
        errEl.textContent = 'Please fill all required fields';
        errEl.style.display = 'block';
        return;
      }
      if (fromLoc === toLoc) {
        errEl.textContent = 'Destination location cannot be same as origin';
        errEl.style.display = 'block';
        return;
      }

      var payload = {
        from_location_id: fromLoc,
        to_location_id:   toLoc,
        items: [{
          product_id: prdId,
          qty: qty
        }],
        remark: remark
      };

      window.ui.withButtonLoading(submitBtn, async function() {
        try {
          await window.api.call('stock.transfer.create', payload);
          window.ui.closeBottomSheet();
          window.ui.toast('Transfer dispatched (IN_TRANSIT)', 'success');
          loadTransfers();
        } catch(err) {
          errEl.textContent = err.message || 'Dispatch failed';
          errEl.style.display = 'block';
        }
      });
    };
  }

  await loadTransfers();
};
