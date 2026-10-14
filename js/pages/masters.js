/**
 * masters.js — Master Data Hub Screen (Doc 06 S17).
 * Sub-tabs: Products | Suppliers | Locations | Stages.
 */

window.pages = window.pages || {};

window.pages.masters = async function(container) {
  var t = window.i18n.t;
  var isOwner = window.auth.isOwnerLike(window.auth.getUser() && window.auth.getUser().role);

  container.innerHTML = `
    <div style="margin-bottom:1rem;">
      <h2 style="margin:0 0 0.5rem 0;">${window.ui.esc(t('masters.title'))}</h2>
      <div style="display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.25rem;" id="masters-tabs-bar">
        <button class="btn btn-secondary tab-btn active" data-sub="products">${window.ui.esc(t('masters.tab_products'))}</button>
        ${isOwner ? `<button class="btn btn-secondary tab-btn" data-sub="suppliers">${window.ui.esc(t('masters.tab_suppliers'))}</button>` : ''}
        <button class="btn btn-secondary tab-btn" data-sub="locations">${window.ui.esc(t('masters.tab_locations'))}</button>
        <button class="btn btn-secondary tab-btn" data-sub="stages">${window.ui.esc(t('masters.tab_stages'))}</button>
      </div>
    </div>
    <div id="masters-sub-content">
      <div style="text-align:center; padding:2rem 0;"><span class="spinner"></span></div>
    </div>
  `;

  var subContent = document.getElementById('masters-sub-content');
  var tabButtons = container.querySelectorAll('.tab-btn');

  var currentTab = 'products';

  function switchTab(tab) {
    currentTab = tab;
    tabButtons.forEach(function(b) {
      if (b.getAttribute('data-sub') === tab) {
        b.classList.remove('btn-secondary');
        b.classList.add('btn-primary');
      } else {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      }
    });

    if (tab === 'products') renderProductsSub(subContent);
    else if (tab === 'suppliers') renderSuppliersSub(subContent);
    else if (tab === 'locations') renderLocationsSub(subContent);
    else if (tab === 'stages') renderStagesSub(subContent);
  }

  tabButtons.forEach(function(btn) {
    btn.onclick = function() {
      switchTab(btn.getAttribute('data-sub'));
    };
  });

  switchTab('products');

  // ---------------------------------------------------------------------------
  // 1. PRODUCTS SUB-VIEW
  // ---------------------------------------------------------------------------
  async function renderProductsSub(target) {
    target.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; gap:0.5rem; flex-wrap:wrap;">
        <input type="text" id="prd-search" class="input" style="flex:1; min-width:180px;" placeholder="${window.ui.esc(t('products.search_placeholder'))}">
        ${isOwner ? `<button id="prd-add-btn" class="btn btn-primary" style="min-height:44px;">+ ${window.ui.esc(t('products.new_btn'))}</button>` : ''}
      </div>
      <div id="prd-list-container">
        <div style="text-align:center; padding:1.5rem 0;"><span class="spinner"></span></div>
      </div>
    `;

    var listEl = document.getElementById('prd-list-container');
    var searchEl = document.getElementById('prd-search');
    var addBtn = document.getElementById('prd-add-btn');

    var products = [];
    try {
      var res = await window.api.call('products.list', {});
      products = res.items || [];
      renderProductItems(products, '');
    } catch(err) {
      listEl.innerHTML = `<div class="card text-error">${window.ui.esc(err.message || 'Failed to load products')}</div>`;
      return;
    }

    function renderProductItems(items, query) {
      var q = (query || '').toLowerCase().trim();
      var filtered = items.filter(function(p) {
        if (!q) return true;
        return (p.name || '').toLowerCase().indexOf(q) >= 0 ||
               (p.brand || '').toLowerCase().indexOf(q) >= 0 ||
               (p.model || '').toLowerCase().indexOf(q) >= 0 ||
               (p.category || '').toLowerCase().indexOf(q) >= 0;
      });

      if (!filtered.length) {
        listEl.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:1.5rem;">${window.ui.esc(t('products.empty'))}</div>`;
        return;
      }

      listEl.innerHTML = filtered.map(function(p) {
        return `
          <div class="card prd-card" data-id="${p.product_id}" style="margin-bottom:0.75rem; cursor:${isOwner ? 'pointer' : 'default'};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-weight:700; color:var(--text-main); font-size:1.05rem;">${window.ui.esc(p.name)}</div>
                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
                  <span class="badge" style="background:#e0f2fe; color:#0369a1;">${window.ui.esc(p.category)}</span>
                  ${p.brand ? ` · ${window.ui.esc(p.brand)}` : ''}
                  ${p.model ? ` (${window.ui.esc(p.model)})` : ''}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
                  Unit: ${window.ui.esc(p.unit)} | Track Serial: ${p.track_serial ? 'YES' : 'NO'} | Min Alert: ${p.low_stock_level !== undefined ? p.low_stock_level : 10}
                </div>
              </div>
              <span class="badge ${p.is_active ? 'badge-success' : 'badge-disabled'}">${p.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
            </div>
          </div>
        `;
      }).join('');

      if (isOwner) {
        listEl.querySelectorAll('.prd-card').forEach(function(card) {
          card.onclick = function() {
            var id = card.getAttribute('data-id');
            var item = products.find(function(x) { return x.product_id === id; });
            if (item) openProductForm(item);
          };
        });
      }
    }

    searchEl.oninput = function() {
      renderProductItems(products, searchEl.value);
    };

    if (addBtn) {
      addBtn.onclick = function() {
        openProductForm(null);
      };
    }

    function openProductForm(p) {
      var isEdit = Boolean(p);
      var title = isEdit ? 'Edit Product' : t('products.new_btn');

      var categories = ['PANEL', 'INVERTER', 'CABLE', 'STRUCTURE', 'ELECTRICAL', 'OTHER'];
      var units = ['nos', 'mtr', 'set', 'kg'];

      var formHtml = `
        <form id="prd-form" novalidate>
          <div class="form-field">
            <label>${window.ui.esc(t('products.name_label'))} *</label>
            <input id="pf-name" type="text" class="input" value="${p ? window.ui.esc(p.name) : ''}" required>
          </div>
          <div class="form-field">
            <label>${window.ui.esc(t('products.category_label'))} *</label>
            <select id="pf-category" class="input">
              ${categories.map(function(c) {
                return `<option value="${c}" ${p && p.category === c ? 'selected' : ''}>${c}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>${window.ui.esc(t('products.brand_label'))}</label>
            <input id="pf-brand" type="text" class="input" value="${p ? window.ui.esc(p.brand || '') : ''}">
          </div>
          <div class="form-field">
            <label>${window.ui.esc(t('products.model_label'))}</label>
            <input id="pf-model" type="text" class="input" value="${p ? window.ui.esc(p.model || '') : ''}">
          </div>
          <div class="form-field">
            <label>${window.ui.esc(t('products.capacity_label'))}</label>
            <input id="pf-cap" type="number" class="input" value="${p ? (p.capacity_watt || '') : ''}">
          </div>
          <div class="form-field">
            <label>${window.ui.esc(t('products.unit_label'))} *</label>
            <select id="pf-unit" class="input">
              ${units.map(function(u) {
                return `<option value="${u}" ${p && p.unit === u ? 'selected' : ''}>${u}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-field">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input id="pf-serial" type="checkbox" ${p && p.track_serial ? 'checked' : ''}>
              <span>${window.ui.esc(t('products.track_serial_label'))}</span>
            </label>
          </div>
          <div class="form-field">
            <label>${window.ui.esc(t('products.low_stock_label'))}</label>
            <input id="pf-low" type="number" class="input" value="${p && p.low_stock_level !== undefined ? p.low_stock_level : 10}">
          </div>
          <div class="form-field">
            <label>${window.ui.esc(t('products.gst_label'))}</label>
            <input id="pf-gst" type="number" class="input" value="${p && p.default_gst_rate !== undefined ? p.default_gst_rate : 12}">
          </div>
          <div id="pf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
          <div class="sheet-footer" style="padding-top:0.75rem; border-top:1px solid var(--border);">
            <button type="submit" id="pf-submit" class="btn btn-primary btn-full">${window.ui.esc(t('btn.save'))}</button>
          </div>
        </form>
      `;

      window.ui.openBottomSheet(title, formHtml, '');

      document.getElementById('prd-form').onsubmit = async function(e) {
        e.preventDefault();
        var errEl = document.getElementById('pf-error');
        var submitBtn = document.getElementById('pf-submit');
        errEl.style.display = 'none';

        var lowVal = document.getElementById('pf-low').value;
        var gstVal = document.getElementById('pf-gst').value;

        var payload = {
          name: document.getElementById('pf-name').value.trim(),
          category: document.getElementById('pf-category').value,
          brand: document.getElementById('pf-brand').value.trim(),
          model: document.getElementById('pf-model').value.trim(),
          capacity_watt: document.getElementById('pf-cap').value ? Number(document.getElementById('pf-cap').value) : null,
          unit: document.getElementById('pf-unit').value,
          track_serial: document.getElementById('pf-serial').checked,
          low_stock_level: lowVal !== '' ? Number(lowVal) : 10,
          default_gst_rate: gstVal !== '' ? Number(gstVal) : 12
        };

        if (!payload.name) {
          errEl.textContent = 'Product name is required';
          errEl.style.display = 'block';
          return;
        }

        window.ui.withButtonLoading(submitBtn, async function() {
          try {
            if (isEdit) {
              payload.product_id = p.product_id;
              await window.api.call('products.update', payload);
            } else {
              await window.api.call('products.create', payload);
            }
            window.ui.closeBottomSheet();
            window.ui.toast(isEdit ? 'Product updated' : 'Product created', 'success');
            renderProductsSub(target);
          } catch(err) {
            errEl.textContent = err.message || 'Operation failed';
            errEl.style.display = 'block';
          }
        });
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 2. SUPPLIERS SUB-VIEW
  // ---------------------------------------------------------------------------
  async function renderSuppliersSub(target) {
    target.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; gap:0.5rem; flex-wrap:wrap;">
        <input type="text" id="sup-search" class="input" style="flex:1; min-width:180px;" placeholder="${window.ui.esc(t('suppliers.search_placeholder'))}">
        <button id="sup-add-btn" class="btn btn-primary" style="min-height:44px;">+ ${window.ui.esc(t('suppliers.new_btn'))}</button>
      </div>
      <div id="sup-list-container">
        <div style="text-align:center; padding:1.5rem 0;"><span class="spinner"></span></div>
      </div>
    `;

    var listEl = document.getElementById('sup-list-container');
    var searchEl = document.getElementById('sup-search');
    var addBtn = document.getElementById('sup-add-btn');

    var suppliers = [];
    try {
      var res = await window.api.call('suppliers.list', {});
      suppliers = res.items || [];
      renderSupplierItems(suppliers, '');
    } catch(err) {
      listEl.innerHTML = `<div class="card text-error">${window.ui.esc(err.message || 'Failed to load suppliers')}</div>`;
      return;
    }

    function renderSupplierItems(items, query) {
      var q = (query || '').toLowerCase().trim();
      var filtered = items.filter(function(s) {
        if (!q) return true;
        return (s.name || '').toLowerCase().indexOf(q) >= 0 || (s.gst_no || '').toLowerCase().indexOf(q) >= 0;
      });

      if (!filtered.length) {
        listEl.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:1.5rem;">${window.ui.esc(t('suppliers.empty'))}</div>`;
        return;
      }

      listEl.innerHTML = filtered.map(function(s) {
        return `
          <div class="card sup-card" data-id="${s.supplier_id}" style="margin-bottom:0.75rem; cursor:pointer;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-weight:700; color:var(--text-main); font-size:1.05rem;">${window.ui.esc(s.name)}</div>
                ${s.gst_no ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">GST: <code>${window.ui.esc(s.gst_no)}</code></div>` : ''}
                ${s.phone ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">📞 ${window.ui.esc(s.phone)}</div>` : ''}
              </div>
              <span class="badge ${s.is_active ? 'badge-success' : 'badge-disabled'}">${s.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
            </div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.sup-card').forEach(function(card) {
        card.onclick = function() {
          var id = card.getAttribute('data-id');
          var item = suppliers.find(function(x) { return x.supplier_id === id; });
          if (item) openSupplierForm(item);
        };
      });
    }

    searchEl.oninput = function() {
      renderSupplierItems(suppliers, searchEl.value);
    };

    addBtn.onclick = function() {
      openSupplierForm(null);
    };

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

      document.getElementById('sup-form').onsubmit = async function(e) {
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

        if (!payload.name) {
          errEl.textContent = 'Supplier name is required';
          errEl.style.display = 'block';
          return;
        }

        window.ui.withButtonLoading(submitBtn, async function() {
          try {
            if (isEdit) {
              payload.supplier_id = s.supplier_id;
              await window.api.call('suppliers.update', payload);
            } else {
              await window.api.call('suppliers.create', payload);
            }
            window.ui.closeBottomSheet();
            window.ui.toast(isEdit ? 'Supplier updated' : 'Supplier created', 'success');
            renderSuppliersSub(target);
          } catch(err) {
            errEl.textContent = err.message || 'Operation failed';
            errEl.style.display = 'block';
          }
        });
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 3. LOCATIONS SUB-VIEW
  // ---------------------------------------------------------------------------
  async function renderLocationsSub(target) {
    target.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; gap:0.5rem; flex-wrap:wrap;">
        <input type="text" id="loc-search" class="input" style="flex:1; min-width:180px;" placeholder="${window.ui.esc(t('locations.search_placeholder'))}">
        ${isOwner ? `<button id="loc-add-btn" class="btn btn-primary" style="min-height:44px;">+ ${window.ui.esc(t('locations.new_btn'))}</button>` : ''}
      </div>
      <div id="loc-list-container">
        <div style="text-align:center; padding:1.5rem 0;"><span class="spinner"></span></div>
      </div>
    `;

    var listEl = document.getElementById('loc-list-container');
    var searchEl = document.getElementById('loc-search');
    var addBtn = document.getElementById('loc-add-btn');

    var locations = [];
    var branches = [];

    try {
      var [locRes, brRes] = await Promise.all([
        window.api.call('locations.list', {}),
        window.api.call('branches.list', {})
      ]);
      locations = locRes.items || [];
      branches = brRes.items || [];
      renderLocationItems(locations, '');
    } catch(err) {
      listEl.innerHTML = `<div class="card text-error">${window.ui.esc(err.message || 'Failed to load locations')}</div>`;
      return;
    }

    function renderLocationItems(items, query) {
      var q = (query || '').toLowerCase().trim();
      var filtered = items.filter(function(l) {
        if (!q) return true;
        return (l.name || '').toLowerCase().indexOf(q) >= 0 || (l.address || '').toLowerCase().indexOf(q) >= 0;
      });

      if (!filtered.length) {
        listEl.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:1.5rem;">${window.ui.esc(t('locations.empty'))}</div>`;
        return;
      }

      listEl.innerHTML = filtered.map(function(l) {
        var br = branches.find(function(b) { return b.branch_id === l.branch_id; });
        return `
          <div class="card loc-card" data-id="${l.location_id}" style="margin-bottom:0.75rem; cursor:${isOwner ? 'pointer' : 'default'};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-weight:700; color:var(--text-main); font-size:1.05rem;">${window.ui.esc(l.name)}</div>
                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
                  🏢 Branch: ${window.ui.esc(br ? br.name : l.branch_id)}
                </div>
                ${l.address ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">📍 ${window.ui.esc(l.address)}</div>` : ''}
              </div>
              <span class="badge ${l.is_active ? 'badge-success' : 'badge-disabled'}">${l.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
            </div>
          </div>
        `;
      }).join('');

      if (isOwner) {
        listEl.querySelectorAll('.loc-card').forEach(function(card) {
          card.onclick = function() {
            var id = card.getAttribute('data-id');
            var item = locations.find(function(x) { return x.location_id === id; });
            if (item) openLocationForm(item);
          };
        });
      }
    }

    searchEl.oninput = function() {
      renderLocationItems(locations, searchEl.value);
    };

    if (addBtn) {
      addBtn.onclick = function() {
        openLocationForm(null);
      };
    }

    function openLocationForm(loc) {
      var isEdit = Boolean(loc);
      var title = isEdit ? 'Edit Location' : t('locations.new_btn');

      var formHtml = `
        <form id="loc-form" novalidate>
          <div class="form-field">
            <label>${window.ui.esc(t('locations.name_label'))} *</label>
            <input id="lf-name" type="text" class="input" value="${loc ? window.ui.esc(loc.name) : ''}" required>
          </div>
          <div class="form-field">
            <label>${window.ui.esc(t('locations.branch_label'))} *</label>
            <select id="lf-branch" class="input">
              ${branches.map(function(b) {
                return `<option value="${b.branch_id}" ${loc && loc.branch_id === b.branch_id ? 'selected' : ''}>${window.ui.esc(b.name)}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>${window.ui.esc(t('locations.address_label'))}</label>
            <textarea id="lf-address" class="input" rows="2">${loc ? window.ui.esc(loc.address || '') : ''}</textarea>
          </div>
          <div id="lf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
          <div class="sheet-footer" style="padding-top:0.75rem; border-top:1px solid var(--border);">
            <button type="submit" id="lf-submit" class="btn btn-primary btn-full">${window.ui.esc(t('btn.save'))}</button>
          </div>
        </form>
      `;

      window.ui.openBottomSheet(title, formHtml, '');

      document.getElementById('loc-form').onsubmit = async function(e) {
        e.preventDefault();
        var errEl = document.getElementById('lf-error');
        var submitBtn = document.getElementById('lf-submit');
        errEl.style.display = 'none';

        var payload = {
          name: document.getElementById('lf-name').value.trim(),
          branch_id: document.getElementById('lf-branch').value,
          address: document.getElementById('lf-address').value.trim()
        };

        if (!payload.name) {
          errEl.textContent = 'Location name is required';
          errEl.style.display = 'block';
          return;
        }

        window.ui.withButtonLoading(submitBtn, async function() {
          try {
            if (isEdit) {
              payload.location_id = loc.location_id;
              await window.api.call('locations.update', payload);
            } else {
              await window.api.call('locations.create', payload);
            }
            window.ui.closeBottomSheet();
            window.ui.toast(isEdit ? 'Location updated' : 'Location created', 'success');
            renderLocationsSub(target);
          } catch(err) {
            errEl.textContent = err.message || 'Operation failed';
            errEl.style.display = 'block';
          }
        });
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 4. STAGES SUB-VIEW
  // ---------------------------------------------------------------------------
  async function renderStagesSub(target) {
    target.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; gap:0.5rem; flex-wrap:wrap;">
        <p class="text-muted" style="margin:0; font-size:0.875rem;">Default project stages timeline order</p>
        ${isOwner ? `<button id="stg-add-btn" class="btn btn-primary" style="min-height:44px;">+ ${window.ui.esc(t('stages.new_btn'))}</button>` : ''}
      </div>
      <div id="stg-list-container">
        <div style="text-align:center; padding:1.5rem 0;"><span class="spinner"></span></div>
      </div>
    `;

    var listEl = document.getElementById('stg-list-container');
    var addBtn = document.getElementById('stg-add-btn');

    var stages = [];
    try {
      var res = await window.api.call('stageMaster.list', {});
      stages = res.items || [];
      renderStageItems();
    } catch(err) {
      listEl.innerHTML = `<div class="card text-error">${window.ui.esc(err.message || 'Failed to load stages')}</div>`;
      return;
    }

    function renderStageItems() {
      if (!stages.length) {
        listEl.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:1.5rem;">${window.ui.esc(t('stages.empty'))}</div>`;
        return;
      }

      listEl.innerHTML = stages.map(function(s, idx) {
        return `
          <div class="card stg-card" data-id="${s.stage_id}" style="margin-bottom:0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <span class="badge" style="background:#f1f5f9; font-weight:700; width:28px; text-align:center;">${s.seq}</span>
                <div>
                  <div style="font-weight:700; color:var(--text-main);">${window.ui.esc(s.name_en)}</div>
                  <div style="font-size:0.85rem; color:var(--text-muted);">${window.ui.esc(s.name_hi)}</div>
                </div>
              </div>
              <div style="display:flex; gap:0.5rem; align-items:center;">
                ${s.requires_photo ? '<span title="Photo required">📷</span>' : ''}
                ${s.is_mandatory ? '<span title="Mandatory" style="color:var(--brand); font-weight:bold;">*</span>' : ''}
                ${isOwner ? `
                  <button class="btn btn-secondary stg-edit-btn" data-id="${s.stage_id}" style="padding:0.25rem 0.5rem; min-height:36px; min-width:36px;">✏️</button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

      if (isOwner) {
        listEl.querySelectorAll('.stg-edit-btn').forEach(function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            var id = btn.getAttribute('data-id');
            var item = stages.find(function(x) { return x.stage_id === id; });
            if (item) openStageForm(item);
          };
        });
      }
    }

    if (addBtn) {
      addBtn.onclick = function() {
        openStageForm(null);
      };
    }

    function openStageForm(stg) {
      var isEdit = Boolean(stg);
      var title = isEdit ? 'Edit Stage' : t('stages.new_btn');
      var nextSeq = stages.length + 1;

      var formHtml = `
        <form id="stg-form" novalidate>
          <div class="form-field">
            <label>${window.ui.esc(t('stages.seq_label'))} *</label>
            <input id="stgf-seq" type="number" class="input" value="${stg ? stg.seq : nextSeq}" required>
          </div>
          <div class="form-field">
            <label>${window.ui.esc(t('stages.name_en_label'))} *</label>
            <input id="stgf-en" type="text" class="input" value="${stg ? window.ui.esc(stg.name_en) : ''}" required>
          </div>
          <div class="form-field">
            <label>${window.ui.esc(t('stages.name_hi_label'))} *</label>
            <input id="stgf-hi" type="text" class="input" value="${stg ? window.ui.esc(stg.name_hi) : ''}" required>
          </div>
          <div class="form-field">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input id="stgf-photo" type="checkbox" ${stg && stg.requires_photo ? 'checked' : ''}>
              <span>${window.ui.esc(t('stages.photo_req_label'))}</span>
            </label>
          </div>
          <div class="form-field">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input id="stgf-mand" type="checkbox" ${!stg || stg.is_mandatory ? 'checked' : ''}>
              <span>${window.ui.esc(t('stages.mandatory_label'))}</span>
            </label>
          </div>
          <div class="form-field">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input id="stgf-mile" type="checkbox" ${stg && stg.is_milestone ? 'checked' : ''}>
              <span>${window.ui.esc(t('stages.milestone_label'))}</span>
            </label>
          </div>
          <div id="stgf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
          <button type="submit" id="stgf-submit" class="btn btn-primary btn-full">${window.ui.esc(t('btn.save'))}</button>
        </form>
      `;

      window.ui.openBottomSheet(title, formHtml, '');

      document.getElementById('stg-form').onsubmit = async function(e) {
        e.preventDefault();
        var errEl = document.getElementById('stgf-error');
        var submitBtn = document.getElementById('stgf-submit');
        errEl.style.display = 'none';

        var payload = {
          seq: Number(document.getElementById('stgf-seq').value),
          name_en: document.getElementById('stgf-en').value.trim(),
          name_hi: document.getElementById('stgf-hi').value.trim(),
          requires_photo: document.getElementById('stgf-photo').checked,
          is_mandatory: document.getElementById('stgf-mand').checked,
          is_milestone: document.getElementById('stgf-mile').checked
        };

        if (!payload.name_en || !payload.name_hi) {
          errEl.textContent = 'Both English and Hindi names are required';
          errEl.style.display = 'block';
          return;
        }

        window.ui.withButtonLoading(submitBtn, async function() {
          try {
            if (isEdit) {
              payload.stage_id = stg.stage_id;
            }
            await window.api.call('stageMaster.upsert', payload);
            window.ui.closeBottomSheet();
            window.ui.toast(isEdit ? 'Stage updated' : 'Stage created', 'success');
            renderStagesSub(target);
          } catch(err) {
            errEl.textContent = err.message || 'Operation failed';
            errEl.style.display = 'block';
          }
        });
      };
    }
  }
};
