/**
 * products.js — Products standalone page (extracted from masters.js).
 * Nav tab: Products (#/products)
 */

window.pages = window.pages || {};

window.pages.products = async function(container) {
  var t = window.i18n.t;
  var isOwner = window.auth.isOwnerLike(window.auth.getUser() && window.auth.getUser().role);

  container.innerHTML = `
    <div style="margin-bottom:0.75rem;">
      <h2 style="margin:0;">${window.ui.esc(t('masters.tab_products') || 'Products')}</h2>
    </div>
    <div id="prd-page-content">
      <div style="text-align:center; padding:2rem 0;"><span class="spinner"></span></div>
    </div>
  `;

  var target = document.getElementById('prd-page-content');
  renderProductsSub(target);

  async function renderProductsSub(target) {
    target.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; gap:0.5rem; flex-wrap:wrap;">
        <div id="prd-search-mount" style="flex:1; min-width:180px;"></div>
        ${isOwner ? `<button id="prd-add-btn" class="btn btn-primary" style="min-height:44px;">+ ${window.ui.esc(t('products.new_btn'))}</button>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
        <label style="font-size:0.85rem;color:var(--text-muted);">Sort:</label>
        <select id="prd-sort-select" class="input" style="width:auto;min-width:140px;font-size:0.85rem;padding:0.25rem 0.5rem;">
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
          <option value="newest">Newest</option>
        </select>
      </div>
      <div id="prd-list-container">
        <div style="text-align:center; padding:1.5rem 0;"><span class="spinner"></span></div>
      </div>
    `;

    var listEl = document.getElementById('prd-list-container');
    var addBtn = document.getElementById('prd-add-btn');
    var sortEl = document.getElementById('prd-sort-select');

    var currentSortPrd = localStorage.getItem('sms_sort_products') || 'name_asc';
    if (sortEl) {
      sortEl.value = currentSortPrd;
      sortEl.onchange = function() {
        currentSortPrd = sortEl.value;
        localStorage.setItem('sms_sort_products', currentSortPrd);
        renderProductItems(products, '');
      };
    }

    var products = [];
    try {
      var res = await window.api.call('products.list', { limit: 9999 });
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

      if (currentSortPrd === 'name_desc') {
        filtered.sort(function(a, b) { return (b.name || '').localeCompare(a.name || ''); });
      } else if (currentSortPrd === 'newest') {
        filtered.sort(function(a, b) {
          var ia = a.product_id || '';
          var ib = b.product_id || '';
          return ia < ib ? 1 : (ia > ib ? -1 : 0);
        });
      } else {
        filtered.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
      }

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

    if (window.components && window.components.createSearchBar) {
      var pBar = window.components.createSearchBar({
        placeholder: t('products.search_placeholder') || 'Search products...',
        onSearch: function(q) { renderProductItems(products, q); }
      });
      var pm = document.getElementById('prd-search-mount');
      if (pm) pm.appendChild(pBar.element);
    }

    if (addBtn) {
      addBtn.onclick = function() { openProductForm(null); };
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
};
