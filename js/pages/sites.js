/**
 * sites.js — Solar Project Sites Directory and Create Screen (Doc 06 S04, S05).
 */

window.pages = window.pages || {};

window.pages.sites = async function(container) {
  var t = window.i18n.t;
  var role = (window.auth.getUser() && window.auth.getUser().role) || 'SITE_USER';
  var isOwner = window.auth.isOwnerLike(role);
  var canCreate = window.auth.isOwnerLike(role) || role === 'MANAGER';
  var currentSort = localStorage.getItem('sms_sort_sites') || 'newest';

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
      <div style="min-width:160px; flex:1;">
        <h2 style="margin:0; font-size:1.35rem; line-height:1.2;">Solar Sites</h2>
        <p class="text-muted" style="margin:0.25rem 0 0; font-size:0.8rem;">Active installations and stage progress</p>
      </div>
      ${canCreate ? '<button id="site-new-btn" class="btn btn-primary" style="min-height:42px; line-height:1.2; padding:0.5rem 0.85rem; font-size:0.875rem; white-space:nowrap; align-self:center;">+ New Site</button>' : ''}
    </div>

    <!-- Filter chips (horizontal scroll with no wrap and smooth touch) -->
    <div style="display:flex; gap:0.35rem; margin-bottom:1rem; overflow-x:auto; padding-bottom:4px; -webkit-overflow-scrolling:touch; scrollbar-width:none;">
      <button class="btn btn-primary site-filter-btn active" data-status="" style="padding:0.35rem 0.75rem; font-size:0.8rem; min-height:36px; white-space:nowrap;">All</button>
      <button class="btn btn-secondary site-filter-btn" data-status="ACTIVE" style="padding:0.35rem 0.75rem; font-size:0.8rem; min-height:36px; white-space:nowrap;">Active</button>
      <button class="btn btn-secondary site-filter-btn" data-status="ON_HOLD" style="padding:0.35rem 0.75rem; font-size:0.8rem; min-height:36px; white-space:nowrap;">Hold</button>
      <button class="btn btn-secondary site-filter-btn" data-status="COMPLETED" style="padding:0.35rem 0.75rem; font-size:0.8rem; min-height:36px; white-space:nowrap;">Done</button>
      <button class="btn btn-secondary" id="site-stuck-toggle" style="padding:0.35rem 0.75rem; font-size:0.8rem; min-height:36px; white-space:nowrap;">Stuck</button>
    </div>

    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
      <label style="font-size:0.85rem;color:var(--text-muted);">Sort:</label>
      <select id="sites-sort-select" class="input" style="width:auto;min-width:140px;font-size:0.85rem;padding:0.25rem 0.5rem;">
        <option value="newest">Newest Created</option>
        <option value="oldest">Oldest Created</option>
        <option value="start_date">Start Date</option>
        <option value="name">Name A-Z</option>
      </select>
    </div>

    <div id="site-list-view">
      <div style="text-align:center; padding:2rem 0;"><span class="spinner"></span></div>
    </div>
  `;

  var listView = document.getElementById('site-list-view');
  var newBtn = document.getElementById('site-new-btn');
  var stuckToggle = document.getElementById('site-stuck-toggle');
  var filterButtons = container.querySelectorAll('.site-filter-btn');
  var sortSelect = document.getElementById('sites-sort-select');

  if (sortSelect) {
    sortSelect.value = currentSort;
    sortSelect.onchange = function() {
      currentSort = sortSelect.value;
      localStorage.setItem('sms_sort_sites', currentSort);
      loadSites(true);
    };
  }

  var currentStatus = '';
  var stuckOnly = false;
  var sites = [];
  var customers = [];
  var stages = [];
  var locations = [];

  try {
    var [cRes, sRes, lRes] = await Promise.all([
      window.api.call('customers.list', {}),
      window.api.call('stageMaster.list', {}),
      window.api.call('locations.list', {})
    ]);
    customers = cRes.items || [];
    stages = sRes.items || [];
    locations = lRes.items || [];
  } catch(e) {
    console.warn('Could not load site masters', e);
  }

  function getCustomerName(id) {
    var c = customers.find(function(x) { return x.customer_id === id; });
    return c ? c.name : id;
  }

  function getStageName(id) {
    var st = stages.find(function(x) { return x.stage_id === id; });
    return st ? st.name_en : id;
  }

  function sortSitesList(list, sortVal) {
    if (!list || !list.length) return list;
    if (sortVal === 'newest') {
      list.sort(function(a, b) {
        var ia = a.site_id || '';
        var ib = b.site_id || '';
        return ia < ib ? 1 : (ia > ib ? -1 : 0);
      });
    } else if (sortVal === 'oldest') {
      list.sort(function(a, b) {
        var ia = a.site_id || '';
        var ib = b.site_id || '';
        return ia > ib ? 1 : (ia < ib ? -1 : 0);
      });
    } else if (sortVal === 'start_date') {
      list.sort(function(a, b) {
        var da = a.start_date || '';
        var db = b.start_date || '';
        return da < db ? 1 : (da > db ? -1 : 0);
      });
    } else if (sortVal === 'name') {
      list.sort(function(a, b) {
        return (a.site_name || '').localeCompare(b.site_name || '');
      });
    }
    return list;
  }

  var SITES_CACHE_KEY = 'sms_cache_sites';

  async function loadSites(forceRefresh) {
    var cached = null;
    if (!forceRefresh) {
      try {
        var raw = sessionStorage.getItem(SITES_CACHE_KEY);
        if (raw) cached = JSON.parse(raw);
      } catch (e) {}
    }

    if (cached) {
      sites = sortSitesList(cached.slice(), currentSort);
      renderSites();
    } else {
      listView.innerHTML = '<div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:0.75rem;">' +
        '<div class="card skeleton" style="height:80px;"></div>'.repeat(4) + '</div>';
    }

    try {
      var payload = { sort: currentSort };
      if (currentStatus) payload.status = currentStatus;
      if (stuckOnly) payload.stuck_only = true;
      var res = await window.api.call('sites.list', payload);
      sites = res.items || [];
      sortSitesList(sites, currentSort);
      try { sessionStorage.setItem(SITES_CACHE_KEY, JSON.stringify(sites)); } catch (e) {}
      renderSites();
    } catch(err) {
      if (!cached) {
        listView.innerHTML = `<div class="card text-error" style="text-align:center;">${window.ui.esc(err.message || 'Failed to load sites')}</div>`;
      } else {
        window.ui.toast(err.message || 'Refresh failed', 'error');
      }
    }
  }

  function renderSites() {
    if (!sites.length) {
      listView.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:2rem 1rem;">No sites found matching criteria.</div>`;
      return;
    }

    listView.innerHTML = sites.map(function(s) {
      var statusClass = s.status === 'ACTIVE' ? 'badge-success' : (s.status === 'ON_HOLD' ? 'badge-warning' : 'badge-disabled');
      var stuckBadge = s.is_stuck ? `<span class="badge" style="background:#fee2e2; color:#b91c1c; margin-left:0.5rem;">⏱️ Stuck (${s.stuck_days}d)</span>` : '';
      var valText = isOwner && s.contract_value_paise ? `₹${(s.contract_value_paise / 100).toLocaleString('en-IN')}` : '';

      return `
        <div class="card site-card" data-id="${s.site_id}" style="margin-bottom:0.75rem; cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:700; font-size:1.05rem; color:var(--text-main);">
                ${window.ui.esc(s.site_name)} ${stuckBadge}
              </div>
              <div style="font-size:0.875rem; color:var(--text-muted); margin-top:0.25rem;">
                👤 ${window.ui.esc(getCustomerName(s.customer_id))} · <strong>${s.system_kw} kW</strong>
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
                Current Stage: <strong style="color:var(--brand);">${window.ui.esc(getStageName(s.current_stage_id) || 'Survey')}</strong>
              </div>
            </div>
            <div style="text-align:right;">
              <span class="badge ${statusClass}">${s.status}</span>
              ${valText ? `<div style="font-weight:700; color:var(--text-main); margin-top:0.5rem; font-size:0.9rem;">${valText}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    listView.querySelectorAll('.site-card').forEach(function(card) {
      card.onclick = function() {
        var id = card.getAttribute('data-id');
        window.location.hash = '#/sites/' + id;
      };
    });
  }

  filterButtons.forEach(function(btn) {
    btn.onclick = function() {
      filterButtons.forEach(function(b) { b.classList.remove('active', 'btn-primary'); b.classList.add('btn-secondary'); });
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-secondary');
      currentStatus = btn.getAttribute('data-status');
      loadSites();
    };
  });

  stuckToggle.onclick = function() {
    stuckOnly = !stuckOnly;
    if (stuckOnly) {
      stuckToggle.classList.remove('btn-secondary');
      stuckToggle.classList.add('btn-primary');
    } else {
      stuckToggle.classList.remove('btn-primary');
      stuckToggle.classList.add('btn-secondary');
    }
    loadSites();
  };

  // ---------------------------------------------------------------------------
  // Create Site Modal
  // ---------------------------------------------------------------------------
  if (newBtn) {
    newBtn.onclick = function() {
      window.ui.withButtonLoading(newBtn, openCreateSiteDialog);
    };
  }

  async function openCreateSiteDialog() {
    var canEnterContractValue = isOwner || (window.auth.getUser() && window.auth.getUser().role === 'MANAGER');
    var siteUsers = [];
    if (window.auth.can('users.list')) {
      try {
        var uRes = await window.api.call('users.list', {});
        var allUsers = uRes.items || uRes.rows || [];
        siteUsers = allUsers.filter(function(u) {
          return u.role === 'SITE_USER' && u.is_active !== false;
        });
      } catch (e) {}
    }

    var formHtml = `
      <form id="create-site-form" novalidate>
        <div class="form-field">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <label style="margin-bottom:0;">Customer *</label>
            <button type="button" id="csf-new-cust-btn" class="btn btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; min-height:28px;">+ New Customer</button>
          </div>
          <select id="csf-customer" class="input" required>
            <option value="">Select Customer</option>
            ${customers.map(function(c) { return `<option value="${c.customer_id}">${window.ui.esc(c.name)} (${c.phone})</option>`; }).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Project / Site Name *</label>
          <input type="text" id="csf-name" class="input" placeholder="e.g. Ramesh Sharma 5kW Solar" required>
        </div>
        <div class="form-field">
          <label>Capacity (kW) *</label>
          <input type="number" step="0.1" id="csf-kw" class="input" placeholder="e.g. 5" required>
        </div>
        <div class="form-field">
          <label>Default Godown / Warehouse *</label>
          <select id="csf-location" class="input" required>
            ${locations.map(function(l) { return `<option value="${l.location_id}">${window.ui.esc(l.name)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>City / Location</label>
          <input type="text" id="csf-city" class="input" placeholder="e.g. Jaipur">
        </div>
        <div class="form-field">
          <label>Target Completion Date</label>
          <input type="date" id="csf-target" class="input">
        </div>
        ${canEnterContractValue ? `
          <div class="form-field">
            <label>Contract Value (₹)</label>
            <input type="number" step="0.01" id="csf-value" class="input" placeholder="Total client price">
          </div>
        ` : ''}
        ${siteUsers.length ? `
          <div class="form-field">
            <label>Assign Site Users (optional)</label>
            <div style="max-height:130px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; padding:0.5rem; background:var(--bg-main);">
              ${siteUsers.map(function(su) {
                return `
                  <label style="display:flex; align-items:center; gap:0.5rem; padding:0.25rem 0; font-size:0.875rem; cursor:pointer;">
                    <input type="checkbox" class="csf-user-check" value="${su.user_id}">
                    <span>${window.ui.esc(su.name)} <span class="text-muted" style="font-size:0.75rem;">(@${window.ui.esc(su.username)})</span></span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
        <div id="csf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="csf-submit" class="btn btn-primary btn-full">Create Project Site</button>
      </form>
    `;

    window.ui.openBottomSheet('New Solar Site', formHtml, '');

    var newCustBtn = document.getElementById('csf-new-cust-btn');
    if (newCustBtn) {
      newCustBtn.onclick = function() {
        var custFormHtml = `
          <form id="inline-cust-form" novalidate>
            <div class="form-field">
              <label>Customer Name *</label>
              <input type="text" id="icf-name" class="input" required placeholder="e.g. Ramesh Sharma">
            </div>
            <div class="form-field">
              <label>Phone Number (10 digits) *</label>
              <input type="tel" id="icf-phone" class="input" required placeholder="e.g. 9876543210" maxlength="10">
            </div>
            <div class="form-field">
              <label>Alternate Phone</label>
              <input type="tel" id="icf-alt-phone" class="input" placeholder="Optional">
            </div>
            <div class="form-field">
              <label>City</label>
              <input type="text" id="icf-city" class="input" placeholder="e.g. Jaipur">
            </div>
            <div class="form-field">
              <label>Address</label>
              <textarea id="icf-address" class="input" rows="2" placeholder="Full address"></textarea>
            </div>
            <div id="icf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
            <button type="submit" id="icf-submit" class="btn btn-primary btn-full">Save Customer</button>
          </form>
        `;

        window.ui.openBottomSheet('New Customer', custFormHtml, '');

        document.getElementById('inline-cust-form').onsubmit = async function(ev) {
          ev.preventDefault();
          var errEl2 = document.getElementById('icf-error');
          var submitBtn2 = document.getElementById('icf-submit');
          errEl2.style.display = 'none';

          var cName = document.getElementById('icf-name').value.trim();
          var cPhone = document.getElementById('icf-phone').value.trim();
          var cAltPhone = document.getElementById('icf-alt-phone').value.trim();
          var cCity = document.getElementById('icf-city').value.trim();
          var cAddress = document.getElementById('icf-address').value.trim();

          if (!cName) {
            errEl2.textContent = 'Name is required';
            errEl2.style.display = 'block';
            return;
          }
          if (!cPhone || cPhone.length < 10) {
            errEl2.textContent = 'Valid 10-digit phone number is required';
            errEl2.style.display = 'block';
            return;
          }

          window.ui.withButtonLoading(submitBtn2, async function() {
            try {
              var newCust = await window.api.call('customers.create', {
                name: cName,
                phone: cPhone,
                alt_phone: cAltPhone,
                city: cCity,
                address: cAddress
              });

              // Auto-select in parent dropdown
              var select = document.getElementById('csf-customer');
              if (select && newCust && newCust.customer_id) {
                customers.push(newCust);
                var opt = document.createElement('option');
                opt.value = newCust.customer_id;
                opt.textContent = newCust.name + ' (' + newCust.phone + ')';
                select.appendChild(opt);
                select.value = newCust.customer_id;
              }

              window.ui.closeBottomSheet();
              window.ui.toast('Customer created', 'success');
            } catch (err) {
              errEl2.textContent = err.message || 'Failed to create customer';
              errEl2.style.display = 'block';
            }
          });
        };
      };
    }

    document.getElementById('create-site-form').onsubmit = async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('csf-error');
      var submitBtn = document.getElementById('csf-submit');
      errEl.style.display = 'none';

      var custId = document.getElementById('csf-customer').value;
      var name = document.getElementById('csf-name').value.trim();
      var kw = parseFloat(document.getElementById('csf-kw').value);
      var locId = document.getElementById('csf-location').value;

      if (!custId || !name || !kw || !locId) {
        errEl.textContent = 'Please fill all required fields';
        errEl.style.display = 'block';
        return;
      }

      var payload = {
        customer_id:         custId,
        site_name:           name,
        system_kw:           kw,
        default_location_id: locId,
        city:                document.getElementById('csf-city').value.trim(),
        target_date:         document.getElementById('csf-target').value
      };

      if (canEnterContractValue) {
        var vEl = document.getElementById('csf-value');
        if (vEl) {
          var vVal = parseFloat(vEl.value);
          if (vVal > 0) payload.contract_value_paise = Math.round(vVal * 100);
        }
      }

      var assignedUserIds = [];
      document.querySelectorAll('.csf-user-check:checked').forEach(function(chk) {
        assignedUserIds.push(chk.value);
      });
      if (assignedUserIds.length > 0) {
        payload.assigned_user_ids = assignedUserIds;
      }

      window.ui.withButtonLoading(submitBtn, async function() {
        try {
          await window.api.call('sites.create', payload);
          window.ui.closeBottomSheet();
          window.ui.toast('Site created with project timeline', 'success');
          loadSites();
        } catch(err) {
          errEl.textContent = err.message || 'Creation failed';
          errEl.style.display = 'block';
        }
      });
    };
  }

  await loadSites();
};
