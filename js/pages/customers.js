/**
 * customers.js — Customers Master Screen (Doc 06 S16).
 * Accessible by OWNER and MANAGER.
 */

window.pages = window.pages || {};

window.pages.customers = async function(container) {
  var t = window.i18n.t;
  var canCreate = window.auth.can('customers.create');
  var canUpdate = window.auth.can('customers.update');

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
      <div>
        <h2 style="margin:0;">${window.ui.esc(t('customers.title'))}</h2>
        <p class="text-muted" style="margin:0.25rem 0 0; font-size:0.875rem;">${window.ui.esc(t('customers.subtitle'))}</p>
      </div>
      ${canCreate ? `<button id="cst-add-btn" class="btn btn-primary" style="min-height:44px;">+ ${window.ui.esc(t('customers.new_btn'))}</button>` : ''}
    </div>

    <div id="cst-search-mount"></div>

    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
      <label style="font-size:0.85rem;color:var(--text-muted);">Sort:</label>
      <select id="cst-sort-select" class="input" style="width:auto;min-width:140px;font-size:0.85rem;padding:0.25rem 0.5rem;">
        <option value="name_asc">Name A-Z</option>
        <option value="name_desc">Name Z-A</option>
        <option value="newest">Newest</option>
      </select>
    </div>

    <div id="cst-list-view">
      <div style="text-align:center; padding:2rem 0;"><span class="spinner"></span></div>
    </div>
  `;

  var listView = document.getElementById('cst-list-view');
  var currentQuery = '';
  var addBtn = document.getElementById('cst-add-btn');
  var sortSelect = document.getElementById('cst-sort-select');

  var currentSortCst = localStorage.getItem('sms_sort_customers') || 'name_asc';
  if (sortSelect) {
    sortSelect.value = currentSortCst;
    sortSelect.onchange = function() {
      currentSortCst = sortSelect.value;
      localStorage.setItem('sms_sort_customers', currentSortCst);
      renderList(currentQuery);
    };
  }

  var customers = [];

  var CUST_CACHE_KEY = 'sms_cache_customers';

  async function loadCustomers(forceRefresh) {
    var cached = null;
    if (!forceRefresh) {
      try {
        var raw = sessionStorage.getItem(CUST_CACHE_KEY);
        if (raw) cached = JSON.parse(raw);
      } catch (e) {}
    }

    if (cached) {
      customers = cached;
      renderList(currentQuery);
    } else {
      listView.innerHTML = '<div style="display:flex;flex-direction:column;gap:0.75rem;">' +
        '<div class="card skeleton" style="height:72px;"></div>'.repeat(4) + '</div>';
    }

    try {
      var res = await window.api.call('customers.list', {});
      customers = res.items || [];
      try { sessionStorage.setItem(CUST_CACHE_KEY, JSON.stringify(customers)); } catch (e) {}
      renderList(currentQuery);
    } catch(err) {
      if (!cached) {
        listView.innerHTML = `<div class="card text-error" style="text-align:center;">Failed to load customers: ${window.ui.esc(err.message || 'Error')}</div>`;
      } else {
        window.ui.toast(err.message || 'Refresh failed', 'error');
      }
    }
  }

  function renderList(query) {
    var q = (query || '').toLowerCase().trim();
    var filtered = customers.filter(function(c) {
      if (!q) return true;
      return (c.name || '').toLowerCase().indexOf(q) >= 0 || (c.phone || '').indexOf(q) >= 0;
    });

    if (currentSortCst === 'name_desc') {
      filtered.sort(function(a, b) { return (b.name || '').localeCompare(a.name || ''); });
    } else if (currentSortCst === 'newest') {
      filtered.sort(function(a, b) {
        var ia = a.customer_id || '';
        var ib = b.customer_id || '';
        return ia < ib ? 1 : (ia > ib ? -1 : 0);
      });
    } else {
      filtered.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
    }

    if (!filtered.length) {
      listView.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:2rem 1rem;">${window.ui.esc(t('customers.empty'))}</div>`;
      return;
    }

    var html = filtered.map(function(c) {
      return `
        <div class="card customer-card" data-id="${c.customer_id}" style="margin-bottom:0.75rem; cursor:${canUpdate ? 'pointer' : 'default'};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:700; font-size:1.05rem; color:var(--text-main);">${window.ui.esc(c.name)}</div>
              <div style="font-size:0.9rem; color:var(--text-muted); margin-top:0.25rem;">
                📞 ${window.ui.esc(c.phone)} ${c.alt_phone ? ' | ' + window.ui.esc(c.alt_phone) : ''}
              </div>
              ${c.city || c.address ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">📍 ${window.ui.esc([c.address, c.city, c.pincode].filter(Boolean).join(', '))}</div>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.25rem;">
              <span class="badge ${c.is_active ? 'badge-success' : 'badge-disabled'}">${c.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
              ${c.doc_count ? `<span class="badge" style="font-size:0.75rem; background:#f1f5f9; color:#475569;">📄 ${c.doc_count}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    listView.innerHTML = html;

    if (canUpdate) {
      listView.querySelectorAll('.customer-card').forEach(function(card) {
        card.onclick = function() {
          var id = card.getAttribute('data-id');
          var cust = customers.find(function(x) { return x.customer_id === id; });
          if (cust) openCustomerForm(cust);
        };
      });
    }
  }

  function openCustomerDetail(c) {
    var detailHtml = `
      <div style="margin-bottom:1rem;">
        <div style="font-weight:700; font-size:1.15rem; color:var(--text-main); margin-bottom:0.25rem;">${window.ui.esc(c.name)}</div>
        <div style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.25rem;">📞 <a href="tel:${window.ui.esc(c.phone)}">${window.ui.esc(c.phone)}</a> ${c.alt_phone ? ' | ' + window.ui.esc(c.alt_phone) : ''}</div>
        ${c.city || c.address ? `<div style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.5rem;">📍 ${window.ui.esc([c.address, c.city, c.pincode].filter(Boolean).join(', '))}</div>` : ''}
        <div style="margin-top:0.75rem;">
          <button id="btn-edit-cust-detail" class="btn btn-outline btn-sm">Edit Details</button>
        </div>
      </div>
      <div id="cust-detail-docs-mount"></div>
    `;
    window.ui.openBottomSheet('Customer: ' + c.name, detailHtml, '');
    var editBtn = document.getElementById('btn-edit-cust-detail');
    if (editBtn) {
      editBtn.onclick = function() {
        openCustomerForm(c);
      };
    }
    if (window.components && window.components.renderDocumentsSection) {
      var mount = document.getElementById('cust-detail-docs-mount');
      if (mount) {
        try {
          window.components.renderDocumentsSection(mount, 'CUSTOMER', c.customer_id, c.name);
        } catch (docErr) {
          mount.innerHTML = '<div class="text-muted" style="font-size:0.85rem;padding:0.75rem 0;">Documents unavailable</div>';
        }
      }
    }
  }

  function openCustomerForm(cust) {
    var isEdit = Boolean(cust);
    var title = isEdit ? 'Edit Customer' : t('customers.new_btn');

    var formHtml = `
      <form id="cust-form" novalidate>
        <div class="form-field">
          <label>${window.ui.esc(t('customers.name_label'))} *</label>
          <input id="cf-name" type="text" class="input" value="${cust ? window.ui.esc(cust.name) : ''}" required>
        </div>
        <div class="form-field">
          <label>${window.ui.esc(t('customers.phone_label'))} *</label>
          <input id="cf-phone" type="tel" inputmode="numeric" class="input" maxlength="10" value="${cust ? window.ui.esc(cust.phone) : ''}" required>
        </div>
        <div class="form-field">
          <label>${window.ui.esc(t('customers.alt_phone_label'))}</label>
          <input id="cf-alt-phone" type="tel" inputmode="numeric" class="input" maxlength="10" value="${cust ? window.ui.esc(cust.alt_phone || '') : ''}">
        </div>
        <div class="form-field">
          <label>${window.ui.esc(t('customers.city_label'))}</label>
          <input id="cf-city" type="text" class="input" value="${cust ? window.ui.esc(cust.city || '') : ''}">
        </div>
        <div class="form-field">
          <label>${window.ui.esc(t('customers.pincode_label'))}</label>
          <input id="cf-pincode" type="text" inputmode="numeric" class="input" maxlength="6" value="${cust ? window.ui.esc(cust.pincode || '') : ''}">
        </div>
        <div class="form-field">
          <label>${window.ui.esc(t('customers.address_label'))}</label>
          <textarea id="cf-address" class="input" rows="2">${cust ? window.ui.esc(cust.address || '') : ''}</textarea>
        </div>
        <div id="cf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <div class="sheet-footer" style="padding-top:0.75rem; border-top:1px solid var(--border);">
          <button type="submit" id="cf-submit" class="btn btn-primary btn-full">${window.ui.esc(t('btn.save'))}</button>
        </div>
      </form>
      ${isEdit ? '<div id="cust-docs-mount"></div>' : ''}
    `;

    window.ui.openBottomSheet(title, formHtml, '');
    if (isEdit && cust && window.components && window.components.renderDocumentsSection) {
      var docMount = document.getElementById('cust-docs-mount');
      if (docMount) {
        try {
          window.components.renderDocumentsSection(docMount, 'CUSTOMER', cust.customer_id, cust.name);
        } catch (docErr) {
          docMount.innerHTML = '<div class="text-muted" style="font-size:0.85rem;padding:0.75rem 0;">Documents unavailable</div>';
        }
      }
    }

    document.getElementById('cust-form').onsubmit = async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('cf-error');
      var submitBtn = document.getElementById('cf-submit');
      errEl.style.display = 'none';

      var payload = {
        name: document.getElementById('cf-name').value.trim(),
        phone: document.getElementById('cf-phone').value.trim(),
        alt_phone: document.getElementById('cf-alt-phone').value.trim(),
        city: document.getElementById('cf-city').value.trim(),
        pincode: document.getElementById('cf-pincode').value.trim(),
        address: document.getElementById('cf-address').value.trim()
      };

      if (!payload.name) {
        errEl.textContent = 'Name is required';
        errEl.style.display = 'block';
        return;
      }
      if (payload.phone.replace(/\D/g, '').length !== 10) {
        errEl.textContent = 'Phone must be exactly 10 digits';
        errEl.style.display = 'block';
        return;
      }

      window.ui.withButtonLoading(submitBtn, async function() {
        try {
          if (isEdit) {
            payload.customer_id = cust.customer_id;
            await window.api.call('customers.update', payload);
          } else {
            await window.api.call('customers.create', payload);
          }
          window.ui.closeBottomSheet();
          window.ui.toast(isEdit ? 'Customer updated' : 'Customer created', 'success');
          await loadCustomers();
        } catch(err) {
          errEl.textContent = (err.code ? '[' + err.code + '] ' : '') + (err.message || 'Operation failed');
          errEl.style.display = 'block';
        }
      });
    };
  }

  if (addBtn) {
    addBtn.onclick = function() {
      openCustomerForm(null);
    };
  }

  if (window.components && window.components.createSearchBar) {
    var sBar = window.components.createSearchBar({
      placeholder: t("customers.search_placeholder") || "Search customer name, phone, city...",
      onSearch: function(q) {
        currentQuery = q;
        renderList(q);
      }
    });
    var sMount = document.getElementById("cst-search-mount");
    if (sMount) sMount.appendChild(sBar.element);
  }

  await loadCustomers();
};
