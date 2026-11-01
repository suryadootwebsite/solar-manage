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
    var canViewPayments = window.auth.can('cpay.ledger') || window.auth.isOwnerLike(window.auth.getUser() && window.auth.getUser().role);
    var canAddPayment = window.auth.can('cpay.add');
    var fmt = function(paise) { return '₹' + ((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); };

    var detailHtml = `
      <div style="display:flex; gap:0.5rem; margin-bottom:1rem; border-bottom:2px solid var(--border); padding-bottom:0.5rem;">
        <button class="btn btn-primary cust-dtab-btn" data-tab="details" style="flex:1;">Details</button>
        ${canViewPayments ? `<button class="btn btn-secondary cust-dtab-btn" data-tab="payments" style="flex:1;">Payments</button>` : ''}
      </div>
      <div id="cust-dtab-details">
        <div style="margin-bottom:1rem;">
          <div style="font-weight:700; font-size:1.15rem; color:var(--text-main); margin-bottom:0.25rem;">${window.ui.esc(c.name)}</div>
          <div style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.25rem;">📞 <a href="tel:${window.ui.esc(c.phone)}">${window.ui.esc(c.phone)}</a> ${c.alt_phone ? ' | ' + window.ui.esc(c.alt_phone) : ''}</div>
          ${c.city || c.address ? `<div style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.5rem;">📍 ${window.ui.esc([c.address, c.city, c.pincode].filter(Boolean).join(', '))}</div>` : ''}
          <div style="margin-top:0.75rem;">
            <button id="btn-edit-cust-detail" class="btn btn-outline btn-sm">Edit Details</button>
          </div>
        </div>
        <div id="cust-detail-docs-mount"></div>
      </div>
      <div id="cust-dtab-payments" style="display:none;">
        <div style="text-align:center; padding:1.5rem 0;"><span class="spinner"></span></div>
      </div>
    `;

    window.ui.openBottomSheet('Customer: ' + c.name, detailHtml, '');

    // Tab switching
    document.querySelectorAll('.cust-dtab-btn').forEach(function(btn) {
      btn.onclick = function() {
        document.querySelectorAll('.cust-dtab-btn').forEach(function(b) {
          b.classList.remove('btn-primary'); b.classList.add('btn-secondary');
        });
        btn.classList.add('btn-primary'); btn.classList.remove('btn-secondary');
        var tab = btn.getAttribute('data-tab');
        document.getElementById('cust-dtab-details').style.display = tab === 'details' ? '' : 'none';
        document.getElementById('cust-dtab-payments').style.display = tab === 'payments' ? '' : 'none';
        if (tab === 'payments') loadCustomerPayments(c);
      };
    });

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

    async function loadCustomerPayments(cust) {
      var payTab = document.getElementById('cust-dtab-payments');
      if (!payTab) return;
      payTab.innerHTML = '<div style="text-align:center;padding:1.5rem 0;"><span class="spinner"></span></div>';
      try {
        var ledger = await window.api.call('cpay.ledger', { customer_id: cust.customer_id });
        var sites = ledger.sites || [];

        var summaryHtml = `
          <div style="display:flex; gap:0.5rem; margin-bottom:1rem;">
            <div class="card" style="flex:1; text-align:center; padding:0.5rem;">
              <div style="font-size:0.75rem; color:var(--text-muted);">Total Contract</div>
              <div style="font-weight:700; font-size:0.95rem;">${fmt(ledger.total_contract_paise)}</div>
            </div>
            <div class="card" style="flex:1; text-align:center; padding:0.5rem;">
              <div style="font-size:0.75rem; color:var(--text-muted);">Total Received</div>
              <div style="font-weight:700; font-size:0.95rem; color:#16a34a;">${fmt(ledger.total_received_paise)}</div>
            </div>
            <div class="card" style="flex:1; text-align:center; padding:0.5rem;">
              <div style="font-size:0.75rem; color:var(--text-muted);">Balance Pending</div>
              <div style="font-weight:700; font-size:0.95rem; color:${ledger.balance_pending_paise > 0 ? '#dc2626' : '#16a34a'};Stream">${fmt(ledger.balance_pending_paise)}</div>
            </div>
          </div>
        `.replace('\Stream', '');

        var payments = ledger.payments || [];
        var historyHtml = payments.length ? `
          <div style="font-weight:700; font-size:0.9rem; margin-bottom:0.5rem;">Payment History</div>
          ${payments.map(function(p) {
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid var(--border); font-size:0.85rem;">
                <div>
                  <div style="font-weight:600;">${fmt(p.amount_paise)} <span class="badge" style="font-size:0.7rem; margin-left:4px;">${window.ui.esc(p.payment_mode || 'BANK')}</span></div>
                  <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                    ${window.ui.esc(p.payment_date || '')} ${p.site_name ? '· Site: ' + window.ui.esc(p.site_name) : ''} ${p.remark ? '· ' + window.ui.esc(p.remark) : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        ` : '<div class="text-muted" style="text-align:center; padding:1rem 0; font-size:0.85rem;">No payments recorded yet.</div>';

        var addPayBtn = canAddPayment ? `
          <button id="cust-add-pay-btn" class="btn btn-primary btn-full" style="margin-top:1rem;">+ Add Payment</button>
        ` : '';

        payTab.innerHTML = summaryHtml + historyHtml + addPayBtn;

        if (canAddPayment) {
          var apBtn = document.getElementById('cust-add-pay-btn');
          if (apBtn) {
            apBtn.onclick = function() {
              openAddCustomerPayment(cust, sites, function() {
                loadCustomerPayments(cust);
              });
            };
          }
        }
      } catch(err) {
        payTab.innerHTML = `<div class="card text-error">${window.ui.esc(err.message || 'Failed to load payments')}</div>`;
      }
    }

    function openAddCustomerPayment(cust, sites, onDone) {
      var siteOptions = sites.map(function(s) {
        return `<option value="${s.site_id}">${window.ui.esc(s.site_name || s.site_id)} (${fmt(s.contract_value_paise)})</option>`;
      }).join('');

      var formHtml = `
        <form id="cpay-add-form" novalidate>
          <div class="form-field">
            <label>Site *</label>
            <select id="cpf-site" class="input" required>
              <option value="">-- Select Site --</option>
              ${siteOptions}
            </select>
          </div>
          <div class="form-field">
            <label>Amount (₹) *</label>
            <input id="cpf-amount" type="number" class="input" min="1" step="1" placeholder="e.g. 50000" required>
          </div>
          <div class="form-field">
            <label>Date *</label>
            <input id="cpf-date" type="date" class="input" value="${new Date().toISOString().slice(0, 10)}" required>
          </div>
          <div class="form-field">
            <label>Payment Type</label>
            <select id="cpf-type" class="input">
              <option value="INSTALLMENT" selected>INSTALLMENT</option>
              <option value="ADVANCE">ADVANCE</option>
              <option value="FINAL">FINAL</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>
          <div class="form-field">
            <label>Payment Mode</label>
            <select id="cpf-mode" class="input">
              <option value="BANK" selected>BANK (NEFT/RTGS/IMPS)</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">CHEQUE</option>
              <option value="CASH">CASH</option>
            </select>
          </div>
          <div class="form-field">
            <label>Ref / Transaction No</label>
            <input id="cpf-ref" type="text" class="input" placeholder="e.g. UTR / Cheque No">
          </div>
          <div class="form-field">
            <label>Remark</label>
            <input id="cpf-remark" type="text" class="input">
          </div>
          <div id="cpf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
          <div class="sheet-footer" style="padding-top:0.75rem; border-top:1px solid var(--border);">
            <button type="submit" id="cpf-submit" class="btn btn-primary btn-full">Save Payment</button>
          </div>
        </form>
      `;

      window.ui.openBottomSheet('Add Payment: ' + cust.name, formHtml, '');

      document.getElementById('cpay-add-form').onsubmit = function(e) {
        e.preventDefault();
        var errEl = document.getElementById('cpf-error');
        var submitBtn = document.getElementById('cpf-submit');
        errEl.style.display = 'none';

        var siteId = document.getElementById('cpf-site').value;
        var amount = parseFloat(document.getElementById('cpf-amount').value);

        if (!siteId) {
          errEl.textContent = 'Please select a site';
          errEl.style.display = 'block';
          return;
        }
        if (!amount || amount <= 0) {
          errEl.textContent = 'Please enter a valid amount';
          errEl.style.display = 'block';
          return;
        }

        var payload = {
          site_id: siteId,
          amount_paise: Math.round(amount * 100),
          type: document.getElementById('cpf-type').value,
          mode: document.getElementById('cpf-mode').value,
          ref_no: document.getElementById('cpf-ref').value.trim(),
          remark: document.getElementById('cpf-remark').value.trim(),
          pay_date: document.getElementById('cpf-date').value
        };

        window.ui.withButtonLoading(submitBtn, async function() {
          await window.api.call('cpay.add', payload);
          window.ui.closeBottomSheet();
          window.ui.showToast('Payment recorded successfully', 'success');
          if (onDone) onDone();
        }).catch(function(err) {
          errEl.textContent = err.message || 'Failed to record payment';
          errEl.style.display = 'block';
        });
      };
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
