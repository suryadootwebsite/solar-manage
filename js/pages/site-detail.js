/**
 * site-detail.js — Site Details, Timeline & Stage Execution Screen (Doc 06 S06, S07).
 */

window.pages = window.pages || {};

window.pages.siteDetail = async function(container, params) {
  var siteId = params ? params.id : '';
  if (!siteId) {
    container.innerHTML = '<div class="card text-error">Missing site ID</div>';
    return;
  }

  var isOwner = window.auth.getUser() && window.auth.getUser().role === 'OWNER';
  var userRole = window.auth.getUser() ? window.auth.getUser().role : '';

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

  async function loadDetails() {
    try {
      var res = await window.api.call('sites.get', { site_id: siteId });
      var site = res.site;
      var stages = res.stages || [];
      var customer = res.customer;
      var assignedUsers = res.assigned_users || [];

      var statusClass = site.status === 'ACTIVE' ? 'badge-success' : (site.status === 'ON_HOLD' ? 'badge-warning' : 'badge-disabled');
      badgeEl.innerHTML = `<span class="badge ${statusClass}">${site.status}</span>`;

      var completedCount = stages.filter(function(s) { return s.status === 'COMPLETED'; }).length;
      var progressPercent = stages.length ? Math.round((completedCount / stages.length) * 100) : 0;

      // Master stage names lookup
      var smRes = await window.api.call('stageMaster.list', {});
      var smMap = {};
      (smRes.items || []).forEach(function(sm) { smMap[sm.stage_id] = sm; });

      var stagesHtml = stages.map(function(stg) {
        var sm = smMap[stg.stage_id] || {};
        var stgClass = stg.status === 'COMPLETED' ? 'badge-success' : (stg.status === 'IN_PROGRESS' ? 'badge-warning' : (stg.status === 'BLOCKED' ? 'badge-danger' : 'badge-disabled'));

        return `
          <div class="card sdt-stage-card" data-sid="${stg.stage_id}" style="margin-bottom:0.5rem; padding:0.75rem; cursor:pointer;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="badge" style="background:#f1f5f9; font-weight:700;">${stg.seq}</span>
                <div>
                  <div style="font-weight:600;">${window.ui.esc(sm.name_en || stg.stage_id)}</div>
                  <div style="font-size:0.8rem; color:var(--text-muted);">${window.ui.esc(sm.name_hi || '')}</div>
                </div>
              </div>
              <div style="text-align:right;">
                <span class="badge ${stgClass}">${stg.status}</span>
                ${stg.block_reason ? `<div style="font-size:0.75rem; color:var(--danger, #dc2626); margin-top:0.25rem;">${window.ui.esc(stg.block_reason)}</div>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

      contentEl.innerHTML = `
        <div class="card" style="margin-bottom:1rem;">
          <h2 style="margin:0 0 0.5rem 0;">${window.ui.esc(site.site_name)}</h2>
          <div style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.5rem;">
            Customer: <strong>${window.ui.esc(customer ? customer.name : site.customer_id)}</strong> ${customer ? `(${window.ui.esc(customer.phone)})` : ''}
          </div>
          <div style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.75rem;">
            Capacity: <strong>${site.system_kw} kW</strong> · Target: ${window.ui.esc(site.target_date || 'N/A')}
          </div>
          <!-- Progress Bar -->
          <div style="margin-top:0.75rem;">
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
              <span>Progress</span>
              <strong>${completedCount} / ${stages.length} Stages (${progressPercent}%)</strong>
            </div>
            <div style="height:8px; background:var(--border); border-radius:4px; overflow:hidden;">
              <div style="height:100%; width:${progressPercent}%; background:var(--brand);"></div>
            </div>
          </div>
        </div>

        <div style="font-weight:700; margin-bottom:0.5rem;">Project Timeline Stages:</div>
        <div>${stagesHtml}</div>
      `;

      // Click to update stage
      contentEl.querySelectorAll('.sdt-stage-card').forEach(function(card) {
        card.onclick = function() {
          var sid = card.getAttribute('data-sid');
          var stg = stages.find(function(x) { return x.stage_id === sid; });
          var sm = smMap[sid] || {};
          if (stg) openUpdateStageDialog(site, stg, sm);
        };
      });

    } catch(err) {
      contentEl.innerHTML = `<div class="card text-error">${window.ui.esc(err.message || 'Failed to load details')}</div>`;
    }
  }

  // ---------------------------------------------------------------------------
  // Update Stage Bottom Sheet (Doc 06 S07)
  // ---------------------------------------------------------------------------
  function openUpdateStageDialog(site, stg, sm) {
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
          <input type="text" id="usf-reason" class="input" value="${window.ui.esc(stg.block_reason || '')}" placeholder="e.g. Structure material missing, Customer unavailable">
        </div>
        <div class="form-field">
          <label>Remark / Notes</label>
          <textarea id="usf-remark" class="input" rows="2">${window.ui.esc(stg.remark || '')}</textarea>
        </div>
        <div id="usf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="usf-submit" class="btn btn-primary btn-full">Save Stage Status</button>
      </form>
    `;

    window.ui.openBottomSheet('Update: ' + (sm.name_en || stg.stage_id), formHtml, '');

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
        loadDetails();
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
