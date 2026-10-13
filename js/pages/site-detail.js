/**
 * site-detail.js — Site Details, Timeline, Material, Serials, Money & Info Tabs (Doc 06 S06, S07).
 */

window.pages = window.pages || {};

window.pages.siteDetail = async function(container, params) {
  var siteId = params ? params.id : '';
  if (!siteId) {
    container.innerHTML = '<div class="card text-error">Missing site ID</div>';
    return;
  }

  var t = window.i18n.t;
  var esc = window.ui.esc;
  var userRole = window.auth.getUser() ? window.auth.getUser().role : 'SITE_USER';
  var isOwner = userRole === 'OWNER' || userRole === 'DEVELOPER';

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
      <button id="sdt-back-btn" class="btn btn-secondary" style="min-height:44px;">&larr; Back</button>
      <div id="sdt-status-badge"></div>
    </div>
    <div id="sdt-content">
      <div style="text-align:center; padding:2rem 0;"><span class="spinner"></span></div>
    </div>
  `;

  document.getElementById('sdt-back-btn').onclick = function() {
    window.location.hash = '#/sites';
  };

  var contentEl = document.getElementById('sdt-content');
  var badgeEl = document.getElementById('sdt-status-badge');

  var currentTab = 'stages';
  var siteData = null;
  var stagesData = [];
  var customerData = null;
  var smMap = {};
  var productsMap = {};

  async function loadDetails() {
    try {
      var [res, smRes, prdRes] = await Promise.all([
        window.api.call('sites.get', { site_id: siteId }),
        window.api.call('stageMaster.list', {}),
        window.api.call('products.list', {})
      ]);

      siteData = res.site;
      stagesData = res.stages || [];
      customerData = res.customer;

      smMap = {};
      (smRes.items || []).forEach(function(sm) { smMap[sm.stage_id] = sm; });

      productsMap = {};
      (prdRes.items || []).forEach(function(p) { productsMap[p.product_id] = p; });

      var statusClass = siteData.status === 'ACTIVE' ? 'badge-success' : (siteData.status === 'ON_HOLD' ? 'badge-warning' : 'badge-disabled');
      badgeEl.innerHTML = `<span class="badge ${statusClass}">${siteData.status}</span>`;

      renderMainShell();
    } catch(err) {
      contentEl.innerHTML = `<div class="card text-error">${esc(err.message || 'Failed to load details')}</div>`;
    }
  }

  function renderMainShell() {
    var completedCount = stagesData.filter(function(s) { return s.status === 'COMPLETED'; }).length;
    var progressPercent = stagesData.length ? Math.round((completedCount / stagesData.length) * 100) : 0;

    var tabs = [
      { id: 'stages', label: t('sites.tab_stages') || 'Stages' },
      { id: 'material', label: t('sites.tab_material') || 'Material' },
      { id: 'serials', label: t('sites.tab_serials') || 'Serials' }
    ];
    if (isOwner) {
      tabs.push({ id: 'money', label: t('sites.tab_money') || 'Money' });
    }
    tabs.push({ id: 'info', label: t('sites.tab_info') || 'Info' });

    contentEl.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <h2 style="margin:0 0 0.5rem 0;">${esc(siteData.site_name)}</h2>
        <div style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.5rem;">
          Customer: <strong>${esc(customerData ? customerData.name : siteData.customer_id)}</strong> ${customerData ? `(${esc(customerData.phone)})` : ''}
        </div>
        <div style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.75rem;">
          Capacity: <strong>${siteData.system_kw} kW</strong> · Target: ${esc(siteData.target_date || 'N/A')}
        </div>
        <!-- Progress Bar -->
        <div style="margin-top:0.75rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
            <span>Progress</span>
            <strong>${completedCount} / ${stagesData.length} Stages (${progressPercent}%)</strong>
          </div>
          <div style="height:8px; background:var(--border); border-radius:4px; overflow:hidden;">
            <div style="height:100%; width:${progressPercent}%; background:var(--brand);"></div>
          </div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div style="display:flex; gap:0.5rem; margin-bottom:1rem; overflow-x:auto; padding-bottom:0.25rem;">
        ${tabs.map(function(tb) {
          var activeClass = tb.id === currentTab ? 'btn-primary active' : 'btn-secondary';
          return `<button class="btn ${activeClass} sdt-tab-btn" data-tab="${tb.id}">${esc(tb.label)}</button>`;
        }).join('')}
      </div>

      <div id="sdt-tab-pane"></div>
    `;

    contentEl.querySelectorAll('.sdt-tab-btn').forEach(function(btn) {
      btn.onclick = function() {
        currentTab = btn.getAttribute('data-tab');
        renderMainShell();
      };
    });

    renderCurrentTab();
  }

  function renderCurrentTab() {
    var pane = document.getElementById('sdt-tab-pane');
    if (!pane) return;

    if (currentTab === 'stages') {
      renderStagesTab(pane);
    } else if (currentTab === 'material') {
      renderMaterialTab(pane);
    } else if (currentTab === 'serials') {
      renderSerialsTab(pane);
    } else if (currentTab === 'money') {
      renderMoneyTab(pane);
    } else if (currentTab === 'info') {
      renderInfoTab(pane);
    }
  }

  // 1. Stages Tab
  function renderStagesTab(pane) {
    var stagesHtml = stagesData.map(function(stg) {
      var sm = smMap[stg.stage_id] || {};
      var stgClass = stg.status === 'COMPLETED' ? 'badge-success' : (stg.status === 'IN_PROGRESS' ? 'badge-warning' : (stg.status === 'BLOCKED' ? 'badge-danger' : 'badge-disabled'));

      return `
        <div class="card sdt-stage-card" data-sid="${stg.stage_id}" style="margin-bottom:0.5rem; padding:0.75rem; cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span class="badge" style="background:#f1f5f9; font-weight:700;">${stg.seq}</span>
              <div>
                <div style="font-weight:600;">${esc(sm.name_en || stg.stage_id)}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${esc(sm.name_hi || '')}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <span class="badge ${stgClass}">${stg.status}</span>
              ${stg.block_reason ? `<div style="font-size:0.75rem; color:var(--danger, #dc2626); margin-top:0.25rem;">${esc(stg.block_reason)}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    pane.innerHTML = `
      <div style="font-weight:700; margin-bottom:0.5rem;">Project Timeline Stages:</div>
      <div>${stagesHtml}</div>
    `;

    pane.querySelectorAll('.sdt-stage-card').forEach(function(card) {
      card.onclick = function() {
        var sid = card.getAttribute('data-sid');
        var stg = stagesData.find(function(x) { return x.stage_id === sid; });
        var sm = smMap[sid] || {};
        if (stg) openUpdateStageDialog(siteData, stg, sm);
      };
    });
  }

  // 2. Material Tab
  async function renderMaterialTab(pane) {
    pane.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 style="margin:0; font-size:1.05rem;">Site Materials</h3>
        <button id="sdt-issue-material-btn" class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.85rem;">+ ${esc(t('sites.issue_material_btn') || 'Issue Material')}</button>
      </div>
      <div id="sdt-material-list"><span class="spinner"></span></div>
    `;

    document.getElementById('sdt-issue-material-btn').onclick = function() {
      openIssueMaterialSheet();
    };

    var listEl = document.getElementById('sdt-material-list');
    try {
      var res = await window.api.call('usage.list', { site_id: siteId });
      var rows = res.items || res.rows || [];
      if (!rows.length) {
        listEl.innerHTML = '<div class="card text-muted" style="text-align:center; padding:1.5rem;">No materials issued to this site yet.</div>';
        return;
      }

      listEl.innerHTML = rows.map(function(r) {
        var prd = productsMap[r.product_id] || {};
        var prdName = prd.name || r.product_id;
        var costInfo = isOwner && r.cost_paise ? `· Cost: ₹${(r.cost_paise / 100).toLocaleString('en-IN')}` : '';
        var badgeClass = r.type === 'ISSUE' ? 'badge-primary' : 'badge-warning';

        return `
          <div class="card" style="margin-bottom:0.5rem; padding:0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600;">${esc(prdName)}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
                  Date: ${esc(r.used_on || r.created_at || '')} · Qty: <strong>${r.qty}</strong> ${costInfo}
                </div>
                ${r.serial_no ? `<div style="font-size:0.75rem; font-family:monospace; color:var(--text-muted);">S/N: ${esc(r.serial_no)}</div>` : ''}
              </div>
              <span class="badge ${badgeClass}">${esc(r.type || 'ISSUE')}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch(e) {
      listEl.innerHTML = `<div class="card text-error">${esc(e.message || 'Failed to load materials')}</div>`;
    }
  }

  // 3. Serials Tab
  async function renderSerialsTab(pane) {
    pane.innerHTML = '<div id="sdt-serials-list"><span class="spinner"></span></div>';
    var listEl = document.getElementById('sdt-serials-list');

    try {
      var res = await window.api.call('serials.list', { site_id: siteId });
      var rows = (res.items || res.rows || []).filter(function(s) { return s.site_id === siteId; });
      if (!rows.length) {
        listEl.innerHTML = '<div class="card text-muted" style="text-align:center; padding:1.5rem;">No serial numbers tracked on this site.</div>';
        return;
      }

      listEl.innerHTML = rows.map(function(s) {
        var prd = productsMap[s.product_id] || {};
        var prdName = prd.name || s.product_id;
        var badgeClass = s.status === 'ISSUED' ? 'badge-primary' : (s.status === 'DEFECTIVE' ? 'badge-danger' : 'badge-disabled');

        return `
          <div class="card" style="margin-bottom:0.5rem; padding:0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; font-family:monospace;">${esc(s.serial_no)}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
                  ${esc(prdName)} · Warranty: ${esc(s.warranty_end || 'N/A')}
                </div>
              </div>
              <span class="badge ${badgeClass}">${esc(s.status)}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch(e) {
      listEl.innerHTML = `<div class="card text-error">${esc(e.message || 'Failed to load serials')}</div>`;
    }
  }

  // 4. Money Tab (OWNER / DEVELOPER only)
  async function renderMoneyTab(pane) {
    pane.innerHTML = '<div id="sdt-money-content"><span class="spinner"></span></div>';
    var moneyEl = document.getElementById('sdt-money-content');

    try {
      var [pnlRes, payRes] = await Promise.all([
        window.api.call('money.sitePnl', { site_id: siteId }).catch(function() { return {}; }),
        window.api.call('cpay.list', { site_id: siteId }).catch(function() { return { items: [] }; })
      ]);

      var pnl = pnlRes.pnl || pnlRes || {};
      var payments = payRes.items || payRes.rows || [];

      moneyEl.innerHTML = `
        <div class="kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:0.75rem; margin-bottom:1rem;">
          <div class="card" style="padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Contract Value</div>
            <div style="font-weight:700; font-size:1.1rem; color:var(--brand);">₹${((pnl.contract_amount_paise || 0) / 100).toLocaleString('en-IN')}</div>
          </div>
          <div class="card" style="padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Total Received</div>
            <div style="font-weight:700; font-size:1.1rem; color:#059669;">₹${((pnl.received_paise || 0) / 100).toLocaleString('en-IN')}</div>
          </div>
          <div class="card" style="padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Total Material Cost</div>
            <div style="font-weight:700; font-size:1.1rem; color:#d97706;">₹${((pnl.cost_paise || 0) / 100).toLocaleString('en-IN')}</div>
          </div>
          <div class="card" style="padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Site Net Profit</div>
            <div style="font-weight:700; font-size:1.1rem; color:${(pnl.profit_paise || 0) >= 0 ? '#059669' : '#dc2626'};">
              ₹${((pnl.profit_paise || 0) / 100).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div style="font-weight:700; margin-bottom:0.5rem;">Customer Payments (${payments.length}):</div>
        ${payments.length ? payments.map(function(p) {
          return `
            <div class="card" style="margin-bottom:0.5rem; padding:0.75rem;">
              <div style="display:flex; justify-content:space-between;">
                <div>
                  <div style="font-weight:600;">₹${((p.amount_paise || 0) / 100).toLocaleString('en-IN')}</div>
                  <div style="font-size:0.8rem; color:var(--text-muted);">${esc(p.payment_type || 'PAYMENT')} · ${esc(p.payment_date || '')}</div>
                </div>
                <span class="badge badge-success">${esc(p.status || 'RECORDED')}</span>
              </div>
            </div>
          `;
        }).join('') : '<div class="card text-muted" style="text-align:center; padding:1rem;">No payments recorded yet.</div>'}
      `;
    } catch(e) {
      moneyEl.innerHTML = `<div class="card text-error">${esc(e.message || 'Failed to load financial data')}</div>`;
    }
  }

  // 5. Info Tab
  function renderInfoTab(pane) {
    pane.innerHTML = `
      <div class="card" style="padding:1rem;">
        <h3 style="margin-top:0; font-size:1.05rem;">Project Details</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; font-size:0.875rem;">
          <div><span class="text-muted">Site ID:</span><br><strong>${esc(siteData.site_id)}</strong></div>
          <div><span class="text-muted">Target Date:</span><br><strong>${esc(siteData.target_date || 'N/A')}</strong></div>
          <div><span class="text-muted">Branch:</span><br><strong>${esc(siteData.branch_id || 'MAIN')}</strong></div>
          <div><span class="text-muted">Godown Location:</span><br><strong>${esc(siteData.default_location_id || 'LOC-MAIN')}</strong></div>
          <div style="grid-column:1 / -1;"><span class="text-muted">Address:</span><br><strong>${esc(siteData.address || 'N/A')}</strong></div>
          <div style="grid-column:1 / -1;"><span class="text-muted">Created On:</span><br><strong>${esc(siteData.created_at || 'N/A')}</strong></div>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Issue Material Bottom Sheet
  // ---------------------------------------------------------------------------
  function openIssueMaterialSheet() {
    var prodsList = Object.values(productsMap);
    var formHtml = `
      <form id="sdt-issue-form" novalidate>
        <div class="form-field">
          <label>Product *</label>
          <select id="sdt-if-product" class="input" required>
            <option value="">Select Product</option>
            ${prodsList.map(function(p) { return `<option value="${p.product_id}" data-serial="${p.track_serial ? '1' : '0'}">${esc(p.name)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-field" id="sdt-if-qty-wrap">
          <label>Quantity *</label>
          <input type="number" id="sdt-if-qty" class="input" min="1" value="1" required>
        </div>
        <div class="form-field" id="sdt-if-serial-wrap" style="display:none;">
          <label>Serial Numbers (comma-separated)</label>
          <textarea id="sdt-if-serials" class="input" rows="2" placeholder="e.g. SN123, SN124"></textarea>
        </div>
        <div class="form-field">
          <label>Issue Date</label>
          <input type="date" id="sdt-if-date" class="input" value="${new Date().toISOString().slice(0, 10)}">
        </div>
        <div id="sdt-if-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="sdt-if-submit" class="btn btn-primary btn-full">Issue Materials</button>
      </form>
    `;

    window.ui.openBottomSheet('Issue Material to ' + siteData.site_name, formHtml, '');

    var prodSelect = document.getElementById('sdt-if-product');
    var qtyWrap = document.getElementById('sdt-if-qty-wrap');
    var serialWrap = document.getElementById('sdt-if-serial-wrap');

    prodSelect.onchange = function() {
      var opt = prodSelect.options[prodSelect.selectedIndex];
      var isSerial = opt && opt.getAttribute('data-serial') === '1';
      qtyWrap.style.display = isSerial ? 'none' : 'block';
      serialWrap.style.display = isSerial ? 'block' : 'none';
    };

    document.getElementById('sdt-issue-form').onsubmit = async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('sdt-if-error');
      var submitBtn = document.getElementById('sdt-if-submit');
      errEl.style.display = 'none';

      var prodId = prodSelect.value;
      if (!prodId) {
        errEl.textContent = 'Product is required';
        errEl.style.display = 'block';
        return;
      }

      var opt = prodSelect.options[prodSelect.selectedIndex];
      var isSerial = opt && opt.getAttribute('data-serial') === '1';
      var line = { product_id: prodId };

      if (isSerial) {
        var rawSn = document.getElementById('sdt-if-serials').value;
        var snList = rawSn.split(/[,\n]+/).map(function(s) { return s.trim(); }).filter(Boolean);
        if (!snList.length) {
          errEl.textContent = 'At least one serial number is required';
          errEl.style.display = 'block';
          return;
        }
        line.serial_nos = snList;
      } else {
        var qty = parseInt(document.getElementById('sdt-if-qty').value, 10);
        if (!qty || qty <= 0) {
          errEl.textContent = 'Valid quantity is required';
          errEl.style.display = 'block';
          return;
        }
        line.qty = qty;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Issuing…';

      try {
        await window.api.call('usage.issue', {
          site_id: siteId,
          location_id: siteData.default_location_id || 'LOC-MAIN',
          used_on: document.getElementById('sdt-if-date').value,
          lines: [line]
        });
        window.ui.closeBottomSheet();
        window.ui.toast('Materials issued successfully', 'success');
        if (currentTab === 'material') renderCurrentTab();
      } catch(err) {
        errEl.textContent = err.message || 'Failed to issue material';
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Issue Materials';
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Stage to Material Prompt
  // ---------------------------------------------------------------------------
  function promptStageMaterial(stageName) {
    var promptHtml = `
      <p style="font-size:0.95rem; color:var(--text-main); margin-bottom:1.5rem;">
        ${esc(t('sites.prompt_material_msg', { stage: stageName }))}
      </p>
      <div style="display:flex; gap:0.5rem;">
        <button id="sdt-prompt-issue-btn" class="btn btn-primary btn-full">${esc(t('sites.btn_issue_now') || 'Issue Now')}</button>
        <button id="sdt-prompt-skip-btn" class="btn btn-secondary btn-full">${esc(t('sites.btn_skip') || 'Skip')}</button>
      </div>
    `;

    window.ui.openBottomSheet(t('sites.prompt_material_title') || 'Issue Material for this Stage?', promptHtml, '');

    document.getElementById('sdt-prompt-skip-btn').onclick = function() {
      window.ui.closeBottomSheet();
    };

    document.getElementById('sdt-prompt-issue-btn').onclick = function() {
      window.ui.closeBottomSheet();
      openIssueMaterialSheet();
    };
  }

  // ---------------------------------------------------------------------------
  // Update Stage Bottom Sheet (Doc 06 S07)
  // ---------------------------------------------------------------------------
  function openUpdateStageDialog(site, stg, sm) {
    var stageName = sm.name_en || stg.stage_id;
    var formHtml = `
      <form id="update-stage-form" novalidate>
        <p class="text-muted" style="margin:0 0 1rem 0;">Current Status: <strong>${stg.status}</strong></p>
        <div class="form-field">
          <label>Target Status *</label>
          <select id="usf-status" class="input" required>
            <option value="IN_PROGRESS" ${stg.status === 'IN_PROGRESS' ? 'selected' : ''}>IN PROGRESS</option>
            <option value="COMPLETED" ${stg.status === 'COMPLETED' ? 'selected' : ''}>COMPLETED</option>
            <option value="BLOCKED" ${stg.status === 'BLOCKED' ? 'selected' : ''}>BLOCKED</option>
            <option value="NOT_APPLICABLE" ${stg.status === 'NOT_APPLICABLE' ? 'selected' : ''}>NOT APPLICABLE</option>
            <option value="NOT_STARTED" ${stg.status === 'NOT_STARTED' ? 'selected' : ''}>NOT STARTED</option>
          </select>
        </div>
        <div class="form-field" id="usf-reason-wrap" style="display:${stg.status === 'BLOCKED' ? 'block' : 'none'};">
          <label>Block Reason *</label>
          <input type="text" id="usf-reason" class="input" value="${esc(stg.block_reason || '')}" placeholder="e.g. Structure material missing, Customer unavailable">
        </div>
        <div class="form-field">
          <label>Remark / Notes</label>
          <textarea id="usf-remark" class="input" rows="2">${esc(stg.remark || '')}</textarea>
        </div>
        <div id="usf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="usf-submit" class="btn btn-primary btn-full">Save Stage Status</button>
      </form>
    `;

    window.ui.openBottomSheet('Update: ' + stageName, formHtml, '');

    var statusSelect = document.getElementById('usf-status');
    var reasonWrap = document.getElementById('usf-reason-wrap');

    statusSelect.onchange = function() {
      reasonWrap.style.display = statusSelect.value === 'BLOCKED' ? 'block' : 'none';
    };

    document.getElementById('update-stage-form').onsubmit = async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('usf-error');
      var submitBtn = document.getElementById('usf-submit');
      errEl.style.display = 'none';

      var toStatus = statusSelect.value;
      var reason = document.getElementById('usf-reason').value.trim();
      var remark = document.getElementById('usf-remark').value.trim();

      if (toStatus === 'BLOCKED' && !reason) {
        errEl.textContent = 'Reason is required when marking stage BLOCKED';
        errEl.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Saving…';

      try {
        await window.api.call('stages.update', {
          site_id:      site.site_id,
          stage_id:     stg.stage_id,
          status:       toStatus,
          block_reason: reason,
          remark:       remark
        });
        window.ui.closeBottomSheet();
        window.ui.toast('Stage updated', 'success');
        await loadDetails();

        // Check if stage transition triggers stage-material prompt
        if (toStatus === 'IN_PROGRESS' || toStatus === 'COMPLETED') {
          promptStageMaterial(stageName);
        }
      } catch(err) {
        errEl.textContent = err.message || 'Update failed';
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Stage Status';
      }
    };
  }

  await loadDetails();
};
