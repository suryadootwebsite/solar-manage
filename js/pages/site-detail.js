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
  var currentUser = window.auth.getUser() || {};
  var userRole = currentUser.role || 'SITE_USER';
  var currentUserId = currentUser.user_id || '';
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
  var assignedUsersData = [];
  var smMap = {};
  var productsMap = {};
  var sitePhotosData = [];
  var _tabLoaded = {};
  var _tabData = {};

  function formatPhotoFileName(siteName, index, total) {
    var cleanSite = String(siteName || 'Site').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').substring(0, 30);
    var now = new Date();
    var yyyy = now.getFullYear();
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var hh = String(now.getHours()).padStart(2, '0');
    var min = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');
    var timeStr = yyyy + mm + dd + '-' + hh + min + ss;
    var suffix = (total && total > 1) ? ('-' + (index + 1)) : '';
    return cleanSite + '-' + timeStr + suffix + '.jpg';
  }

  function compressPhotoAndThumb(file) {
    return new Promise(function(resolve, reject) {
      if (!file || !file.type.startsWith('image/')) {
        return resolve(null);
      }
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          // 1. Full photo: max 1600px, quality 0.85
          var w = img.width;
          var h = img.height;
          var maxD = 1600;
          if (w > maxD || h > maxD) {
            if (w > h) {
              h = Math.round((h * maxD) / w);
              w = maxD;
            } else {
              w = Math.round((w * maxD) / h);
              h = maxD;
            }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var mainDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          var mainBase64 = mainDataUrl.split(',')[1];

          // 2. Thumbnail: max 320px, quality 0.70
          var tw = img.width;
          var th = img.height;
          var maxT = 320;
          if (tw > maxT || th > maxT) {
            if (tw > th) {
              th = Math.round((th * maxT) / tw);
              tw = maxT;
            } else {
              tw = Math.round((tw * maxT) / th);
              th = maxT;
            }
          }
          var tCanvas = document.createElement('canvas');
          tCanvas.width = tw;
          tCanvas.height = th;
          var tCtx = tCanvas.getContext('2d');
          tCtx.drawImage(img, 0, 0, tw, th);
          var thumbDataUrl = tCanvas.toDataURL('image/jpeg', 0.70);
          var thumbBase64 = thumbDataUrl.split(',')[1];

          resolve({
            base64: mainBase64,
            thumbBase64: thumbBase64,
            mimeType: 'image/jpeg'
          });
        };
        img.onerror = function() {
          var rawBase64 = String(e.target.result).split(',')[1];
          resolve({ base64: rawBase64, thumbBase64: '', mimeType: file.type || 'image/jpeg' });
        };
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function compressImage(file, maxD, quality) {
    return compressPhotoAndThumb(file);
  }

  // Lazy thumbnail loader (max 3 concurrent) with sessionStorage cache
  var _thumbQueue = [];
  var _thumbActiveCount = 0;
  var MAX_PARALLEL_THUMBS = 3;

  function loadPhotoThumb(photoId, imgEl, skelEl) {
    if (!photoId) return;
    var cacheKey = 'pimg_' + photoId + '_thumb';
    var cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      if (imgEl) {
        imgEl.src = cached;
        imgEl.style.display = 'block';
      }
      if (skelEl) skelEl.style.display = 'none';
      return;
    }

    _thumbQueue.push({
      photoId: photoId,
      imgEl: imgEl,
      skelEl: skelEl
    });
    _processThumbQueue();
  }

  function _processThumbQueue() {
    while (_thumbActiveCount < MAX_PARALLEL_THUMBS && _thumbQueue.length > 0) {
      var item = _thumbQueue.shift();
      _thumbActiveCount++;
      (function(task) {
        window.api.call('photos.image', { photo_id: task.photoId, size: 'thumb' })
          .then(function(res) {
            if (res && res.data_uri) {
              try { sessionStorage.setItem('pimg_' + task.photoId + '_thumb', res.data_uri); } catch(e) {}
              if (task.imgEl) {
                task.imgEl.src = res.data_uri;
                task.imgEl.style.display = 'block';
              }
              if (task.skelEl) task.skelEl.style.display = 'none';
            }
          })
          .catch(function() {
            if (task.skelEl) {
              task.skelEl.innerHTML = '<span style="font-size:1.5rem; opacity:0.4;">📷</span>';
            }
          })
          .finally(function() {
            _thumbActiveCount--;
            _processThumbQueue();
          });
      })(item);
    }
  }

  // Modal full photo viewer
  async function openFullPhotoModal(photoId, caption, uploadedAt) {
    var modalHtml = `
      <div id="full-photo-modal-content" style="text-align:center; position:relative; min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <div id="fpm-spinner" style="padding:2rem;"><span class="spinner"></span></div>
        <img id="fpm-img" style="display:none; max-width:100%; max-height:70vh; border-radius:6px; object-fit:contain; box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
        <div id="fpm-meta" style="margin-top:0.75rem; font-size:0.85rem; color:var(--text-muted); display:none;">
          <div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${esc(caption || 'Site Photo')}</div>
          <div>${uploadedAt ? esc(uploadedAt.slice(0, 10)) : ''}</div>
        </div>
      </div>
    `;
    window.ui.openBottomSheet('Photo View', modalHtml, '');

    var cacheKey = 'pimg_' + photoId + '_full';
    var cached = sessionStorage.getItem(cacheKey);
    var spinnerEl = document.getElementById('fpm-spinner');
    var imgEl = document.getElementById('fpm-img');
    var metaEl = document.getElementById('fpm-meta');

    if (cached) {
      if (spinnerEl) spinnerEl.style.display = 'none';
      if (imgEl) { imgEl.src = cached; imgEl.style.display = 'block'; }
      if (metaEl) metaEl.style.display = 'block';
      return;
    }

    try {
      var res = await window.api.call('photos.image', { photo_id: photoId, size: 'full' });
      if (res && res.data_uri) {
        try { sessionStorage.setItem(cacheKey, res.data_uri); } catch(e) {}
        if (spinnerEl) spinnerEl.style.display = 'none';
        if (imgEl) { imgEl.src = res.data_uri; imgEl.style.display = 'block'; }
        if (metaEl) metaEl.style.display = 'block';
      }
    } catch(err) {
      if (spinnerEl) spinnerEl.innerHTML = '<div class="text-error">Failed to load photo: ' + esc(err.message || 'Error') + '</div>';
    }
  }

  // 2-step verification delete dialog
  function openDeletePhotoDialog(photoId, onSuccess) {
    var dialogHtml = `
      <div id="del-photo-flow" style="padding:0.5rem 0;">
        <p style="font-weight:600; color:#dc2626; margin:0 0 0.5rem 0;">⚠️ Permanent Deletion</p>
        <p style="font-size:0.875rem; color:var(--text-muted); margin:0 0 1rem 0;">
          Are you sure you want to permanently delete this photo? This will remove the file from storage and cannot be undone.
        </p>
        <div class="form-field">
          <label style="font-weight:600; font-size:0.85rem;">Type <strong>DELETE</strong> to confirm:</label>
          <input type="text" id="del-photo-input" class="input" placeholder="DELETE" autocomplete="off" style="margin-top:0.25rem;">
        </div>
        <div id="del-photo-err" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button id="del-photo-btn" class="btn btn-full" disabled style="background:#dc2626; color:#fff; border:none; opacity:0.5; cursor:not-allowed;">Confirm Delete</button>
      </div>
    `;
    window.ui.openBottomSheet('Delete Photo', dialogHtml, '');

    var inputEl = document.getElementById('del-photo-input');
    var btnEl = document.getElementById('del-photo-btn');
    var errEl = document.getElementById('del-photo-err');

    inputEl.oninput = function() {
      if (inputEl.value.trim() === 'DELETE') {
        btnEl.disabled = false;
        btnEl.style.opacity = '1';
        btnEl.style.cursor = 'pointer';
      } else {
        btnEl.disabled = true;
        btnEl.style.opacity = '0.5';
        btnEl.style.cursor = 'not-allowed';
      }
    };

    btnEl.onclick = async function() {
      if (inputEl.value.trim() !== 'DELETE') return;
      window.ui.withButtonLoading(btnEl, async function() {
        try {
          await window.api.call('photos.delete', { photo_id: photoId, confirm: true });
          sessionStorage.removeItem('pimg_' + photoId + '_thumb');
          sessionStorage.removeItem('pimg_' + photoId + '_full');
          window.ui.closeBottomSheet();
          window.ui.toast('Photo permanently deleted', 'success');
          if (typeof onSuccess === 'function') onSuccess();
        } catch(dErr) {
          errEl.textContent = dErr.message || 'Deletion failed';
          errEl.style.display = 'block';
        }
      });
    };
  }

  async function ensureProductsLoaded() {
    if (Object.keys(productsMap).length > 0) return productsMap;
    try {
      var prdRes = await window.api.call('products.list', {});
      (prdRes.items || []).forEach(function(p) { productsMap[p.product_id] = p; });
    } catch(e) {}
    return productsMap;
  }

  async function loadDetails() {
    _tabLoaded = {};
    _tabData = {};
    try {
      var res = await window.api.call('sites.getFull', { site_id: siteId });

      siteData = res.site;
      stagesData = res.stages || [];
      customerData = res.customer;
      assignedUsersData = res.assigned_users || [];

      try {
        var pRes = await window.api.call('photos.list', { site_id: siteId, include_archived: false });
        sitePhotosData = (pRes && pRes.photos) || [];
      } catch (pe) {
        sitePhotosData = [];
      }

      smMap = {};
      stagesData.forEach(function(sm) { smMap[sm.stage_id] = sm; });

      var statusClass = siteData.status === 'ACTIVE' ? 'badge-success' : (siteData.status === 'ON_HOLD' ? 'badge-warning' : (siteData.status === 'COMPLETED' ? 'badge-success' : 'badge-disabled'));
      var stuckHtml = siteData.is_stuck ? `<span class="badge badge-danger" style="margin-right:0.5rem;" title="${esc(siteData.stuck_reason || 'Site is stuck')}">⚠️ Stuck${siteData.stuck_reason ? ': ' + esc(siteData.stuck_reason) : ''}</span>` : '';
      var canChangeStatus = isOwner || userRole === 'MANAGER';
      badgeEl.innerHTML = `
        ${stuckHtml}
        <button id="sdt-status-btn" class="badge ${statusClass}" style="cursor:${canChangeStatus ? 'pointer' : 'default'}; border:none; outline:none; font-size:0.85rem; padding:0.35rem 0.65rem;" ${!canChangeStatus ? 'disabled' : ''}>
          ${siteData.status} ${canChangeStatus ? '▾' : ''}
        </button>
      `;

      if (canChangeStatus) {
        document.getElementById('sdt-status-btn').onclick = function() {
          openSiteStatusDialog();
        };
      }

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
      { id: 'serials', label: t('sites.tab_serials') || 'Serials' },
      { id: 'photos', label: t('sites.tab_photos') || 'Photos' }
    ];
    if (isOwner || userRole === 'MANAGER') {
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
        var nextTab = btn.getAttribute('data-tab');
        if (nextTab === currentTab) return;
        currentTab = nextTab;
        contentEl.querySelectorAll('.sdt-tab-btn').forEach(function(b) {
          if (b.getAttribute('data-tab') === currentTab) {
            b.className = 'btn btn-primary active sdt-tab-btn';
          } else {
            b.className = 'btn btn-secondary sdt-tab-btn';
          }
        });
        renderCurrentTab();
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
    } else if (currentTab === 'photos') {
      renderPhotosTab(pane);
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
      var isReqPhoto = sm.requires_photo === true || sm.requires_photo === 'TRUE' || sm.requires_photo === 1;
      var stgPhotos = sitePhotosData.filter(function(p) { return p.stage_id === stg.stage_id && !p.archived && p.is_active !== false; });

      return `
        <div class="card sdt-stage-card" data-sid="${stg.stage_id}" style="margin-bottom:0.5rem; padding:0.75rem; cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span class="badge" style="background:#f1f5f9; font-weight:700;">${stg.seq}</span>
              <div>
                <div style="font-weight:600; display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                  <span>${esc(sm.name_en || stg.stage_id)}</span>
                  ${stgPhotos.length > 0 ? `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.68rem; font-weight:600; padding:0.15rem 0.4rem; border:1px solid #bae6fd;">📷 ${stgPhotos.length} Photo${stgPhotos.length > 1 ? 's' : ''}</span>` : ''}
                  ${isReqPhoto ? '<span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.68rem; font-weight:600; padding:0.15rem 0.4rem; border:1px solid #fde68a;">📷 Photo Required</span>' : ''}
                </div>
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
    if (_tabLoaded['material'] && _tabData['material']) {
      pane.innerHTML = _tabData['material'];
      _bindMaterialEvents(pane);
      return;
    }

    pane.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 style="margin:0; font-size:1.05rem;">Site Materials</h3>
        <button id="sdt-issue-material-btn" class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.85rem;">+ ${esc(t('sites.issue_material_btn') || 'Issue Material')}</button>
      </div>
      <div id="sdt-material-list"><span class="spinner"></span></div>
    `;

    _bindMaterialEvents(pane);

    var listEl = document.getElementById('sdt-material-list');
    try {
      await ensureProductsLoaded();
      var res = await window.api.call('usage.list', { site_id: siteId });
      var rows = res.items || res.rows || [];
      if (!rows.length) {
        listEl.innerHTML = '<div class="card text-muted" style="text-align:center; padding:1.5rem;">No materials issued to this site yet.</div>';
      } else {
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
      }
      _tabData['material'] = pane.innerHTML;
      _tabLoaded['material'] = true;
    } catch(e) {
      if (listEl) listEl.innerHTML = `<div class="card text-error">${esc(e.message || 'Failed to load materials')}</div>`;
    }
  }

  function _bindMaterialEvents(pane) {
    var btn = pane.querySelector('#sdt-issue-material-btn');
    if (btn) {
      btn.onclick = function() {
        openIssueMaterialSheet();
      };
    }
  }

  // 3. Serials Tab
  async function renderSerialsTab(pane) {
    if (_tabLoaded['serials'] && _tabData['serials']) {
      pane.innerHTML = _tabData['serials'];
      return;
    }

    pane.innerHTML = '<div id="sdt-serials-list"><span class="spinner"></span></div>';
    var listEl = document.getElementById('sdt-serials-list');

    try {
      await ensureProductsLoaded();
      var res = await window.api.call('serials.list', { site_id: siteId });
      var rows = (res.items || res.rows || []).filter(function(s) { return s.site_id === siteId; });
      if (!rows.length) {
        listEl.innerHTML = '<div class="card text-muted" style="text-align:center; padding:1.5rem;">No serial numbers tracked on this site.</div>';
      } else {
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
      }
      _tabData['serials'] = pane.innerHTML;
      _tabLoaded['serials'] = true;
    } catch(e) {
      if (listEl) listEl.innerHTML = `<div class="card text-error">${esc(e.message || 'Failed to load serials')}</div>`;
    }
  }

  // 3b. Photos Tab (S12)
  async function renderPhotosTab(pane) {
    if (_tabLoaded['photos'] && _tabData['photos']) {
      pane.innerHTML = _tabData['photos'];
      attachPhotosEventListeners();
      return;
    }

    pane.innerHTML = '<div id="sdt-photos-wrap"><span class="spinner"></span></div>';
    var wrapEl = document.getElementById('sdt-photos-wrap');

    try {
      var res = await window.api.call('photos.list', { site_id: siteId, include_archived: true });
      var photos = (res && res.photos) || [];

      var headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <div>
            <h3 style="margin:0; font-size:1.05rem;">Site Photos (${photos.length})</h3>
            <span style="font-size:0.8rem; color:var(--text-muted);">Installation and inspection photo records</span>
          </div>
          <button id="btn-upload-photo" class="btn btn-primary btn-sm">📷 + Upload Photo</button>
        </div>
      `;

      var bodyHtml = '';
      if (!photos.length) {
        bodyHtml = `
          <div class="card text-muted" style="text-align:center; padding:2rem 1rem;">
            <div style="font-size:2.5rem; margin-bottom:0.5rem;">📸</div>
            <p style="margin:0 0 0.5rem 0; font-weight:600; font-size:1rem;">No photos attached yet</p>
            <p style="margin:0 0 1rem 0; font-size:0.85rem;">Capture or upload site survey, structure, panels, and wiring photos.</p>
            <button id="btn-upload-photo-empty" class="btn btn-primary btn-sm">📷 Upload First Photo</button>
          </div>
        `;
      } else {
        bodyHtml = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:0.75rem;">` +
          photos.map(function(p) {
            var stg = stagesData.find(function(s) { return s.stage_id === p.stage_id; });
            var sm = (stg && smMap[stg.stage_id]) || {};
            var stgName = sm.name_en || p.stage_id || 'General';
            var isArch = !!p.archived;
            var canDelete = (isOwner || userRole === 'MANAGER' || (userRole === 'SITE_USER' && p.uploaded_by === currentUserId));

            return `
              <div class="card sdt-photo-card" data-photo-id="${esc(p.photo_id)}" data-caption="${esc(p.caption || '')}" data-date="${esc(p.uploaded_at || '')}" style="padding:0.5rem; display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;">
                <div style="position:relative; width:100%; height:110px; background:var(--border,#e2e8f0); border-radius:4px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                  <div class="photo-skel" id="skel-${esc(p.photo_id)}" style="width:100%; height:100%; background:linear-gradient(90deg, #e2e8f0 25%, #cbd5e1 50%, #e2e8f0 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; display:flex; align-items:center; justify-content:center;">
                    <span style="font-size:1.5rem; opacity:0.3;">📸</span>
                  </div>
                  <img id="img-${esc(p.photo_id)}" alt="${esc(p.caption || 'Photo')}" style="display:none; width:100%; height:100%; object-fit:cover;" />
                  ${isArch ? '<span style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.7); color:#fff; font-size:0.65rem; padding:2px 4px; border-radius:3px;">Archived</span>' : ''}
                </div>
                <div style="margin-top:0.4rem; font-size:0.75rem;">
                  <span class="badge badge-secondary" style="font-size:0.65rem; display:inline-block; margin-bottom:0.2rem;">${esc(stgName)}</span>
                  <div style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(p.caption || 'Photo')}">${esc(p.caption || 'No caption')}</div>
                  <div style="color:var(--text-muted); font-size:0.7rem; margin-top:0.15rem;">${(p.uploaded_at || '').slice(0, 10)} · ${p.size_kb || 0} KB</div>
                </div>
                ${canDelete ? `
                  <button class="btn btn-outline btn-sm btn-delete-photo" data-photo-id="${esc(p.photo_id)}" style="margin-top:0.4rem; padding:0.2rem 0.4rem; font-size:0.7rem; color:#dc2626; border-color:#fca5a5;">🗑️ Delete</button>
                ` : ''}
              </div>
            `;
          }).join('') +
        `</div>`;
      }

      wrapEl.innerHTML = headerHtml + bodyHtml;
      _tabData['photos'] = wrapEl.innerHTML;
      _tabLoaded['photos'] = true;
      attachPhotosEventListeners();

      // Trigger lazy loads for thumbnails
      photos.forEach(function(p) {
        var imgEl = document.getElementById('img-' + p.photo_id);
        var skelEl = document.getElementById('skel-' + p.photo_id);
        if (imgEl) loadPhotoThumb(p.photo_id, imgEl, skelEl);
      });
    } catch(err) {
      if (wrapEl) wrapEl.innerHTML = `<div class="card text-error">${esc(err.message || 'Failed to load photos')}</div>`;
    }
  }

  function attachPhotosEventListeners() {
    var upBtn = document.getElementById('btn-upload-photo');
    if (upBtn) {
      upBtn.onclick = function() { openUploadPhotoModal(); };
    }
    var upEmptyBtn = document.getElementById('btn-upload-photo-empty');
    if (upEmptyBtn) {
      upEmptyBtn.onclick = function() { openUploadPhotoModal(); };
    }

    var cards = document.querySelectorAll('.sdt-photo-card');
    cards.forEach(function(card) {
      card.onclick = function(ev) {
        if (ev.target.closest('.btn-delete-photo')) return;
        var pId = card.getAttribute('data-photo-id');
        var caption = card.getAttribute('data-caption') || '';
        var date = card.getAttribute('data-date') || '';
        openFullPhotoModal(pId, caption, date);
      };
    });

    var delBtns = document.querySelectorAll('.btn-delete-photo');
    delBtns.forEach(function(delBtn) {
      delBtn.onclick = function(ev) {
        ev.stopPropagation();
        var pId = delBtn.getAttribute('data-photo-id');
        openDeletePhotoDialog(pId, function() {
          _tabLoaded['photos'] = false;
          _tabData['photos'] = null;
          var pane = document.getElementById('sdt-tab-pane');
          if (pane) renderPhotosTab(pane);
        });
      };
    });
  }

  function openUploadPhotoModal(defaultStageId) {
    var stageOptions = '<option value="">(General Site Photo)</option>' +
      stagesData.map(function(stg) {
        var sm = smMap[stg.stage_id] || {};
        var name = sm.name_en || stg.stage_id;
        var selected = (defaultStageId === stg.stage_id) ? 'selected' : '';
        return '<option value="' + esc(stg.stage_id) + '" ' + selected + '>' + esc(name) + ' (' + esc(stg.status) + ')</option>';
      }).join('');

    var formHtml = `
      <form id="upload-photo-form" novalidate>
        <div class="form-field">
          <label>Select or Capture Photo *</label>
          <input type="file" id="upf-file" accept="image/*" capture="environment" class="input" required style="padding:0.4rem;">
        </div>
        <div id="upf-preview-wrap" style="display:none; text-align:center; margin:0.5rem 0;">
          <img id="upf-preview" style="max-height:160px; max-width:100%; border-radius:6px; border:1px solid var(--border,#e2e8f0);">
        </div>
        <div class="form-field">
          <label>Stage (Optional)</label>
          <select id="upf-stage" class="input">
            ${stageOptions}
          </select>
        </div>
        <div class="form-field">
          <label>Caption / Notes</label>
          <input type="text" id="upf-caption" class="input" placeholder="e.g. Structure mounted on roof">
        </div>
        <div id="upf-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="upf-submit" class="btn btn-primary btn-full">Upload Photo</button>
      </form>
    `;

    window.ui.openBottomSheet('Upload Site Photo', formHtml, '');

    var fileInput = document.getElementById('upf-file');
    var previewWrap = document.getElementById('upf-preview-wrap');
    var previewImg = document.getElementById('upf-preview');

    fileInput.onchange = function() {
      if (fileInput.files && fileInput.files[0]) {
        var f = fileInput.files[0];
        var r = new FileReader();
        r.onload = function(ev) {
          previewImg.src = ev.target.result;
          previewWrap.style.display = 'block';
        };
        r.readAsDataURL(f);
      }
    };

    var form = document.getElementById('upload-photo-form');
    var submitBtn = document.getElementById('upf-submit');
    var errEl = document.getElementById('upf-error');

    form.onsubmit = async function(e) {
      e.preventDefault();
      errEl.style.display = 'none';

      if (!fileInput.files || !fileInput.files[0]) {
        errEl.textContent = 'Please choose or capture a photo.';
        errEl.style.display = 'block';
        return;
      }

      await window.ui.withButtonLoading(submitBtn, async function() {
        try {
          var compressed = await compressPhotoAndThumb(fileInput.files[0]);
          var stageId = document.getElementById('upf-stage').value || '';
          var caption = document.getElementById('upf-caption').value || '';

          await window.api.call('photos.upload', {
            site_id:           siteId,
            stage_id:          stageId,
            caption:           caption,
            data_base64:       compressed.base64,
            thumb_data_base64: compressed.thumbBase64,
            mime_type:         compressed.mimeType,
            file_name:         'photo.jpg'
          });

          window.ui.closeBottomSheet();
          window.ui.showToast('Photo uploaded successfully! 📸', 'success');
          _tabLoaded['photos'] = false;
          _tabData['photos'] = null;
          var pane = document.getElementById('sdt-tab-pane');
          if (pane) renderPhotosTab(pane);
        } catch(upErr) {
          errEl.textContent = upErr.message || 'Upload failed';
          errEl.style.display = 'block';
        }
      });
    };
  }

  // 4. Money Tab (OWNER / DEVELOPER full P&L & expenses; MANAGER add-only expense)  // 4. Money Tab (OWNER / DEVELOPER full P&L & expenses; MANAGER add-only expense)
  async function renderMoneyTab(pane) {
    if (_tabLoaded['money'] && _tabData['money']) {
      pane.innerHTML = _tabData['money'];
      _bindMoneyEvents(pane);
      return;
    }

    pane.innerHTML = '<div id="sdt-money-content"><span class="spinner"></span></div>';
    var moneyEl = document.getElementById('sdt-money-content');

    // MANAGER: Add-only interface (0 financial leaks)
    if (!isOwner) {
      moneyEl.innerHTML = `
        <div class="card" style="margin-bottom:1rem; padding:1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h3 style="margin:0; font-size:1.1rem;">Site Expenses</h3>
              <p class="text-muted" style="margin:0.25rem 0 0; font-size:0.85rem;">Record field expenses incurred for this site</p>
            </div>
            <button id="sdt-mgr-add-exp-btn" class="btn btn-primary" style="min-height:44px;">+ Add Expense</button>
          </div>
        </div>
      `;
      _bindMoneyEvents(pane);
      _tabData['money'] = pane.innerHTML;
      _tabLoaded['money'] = true;
      return;
    }

    try {
      var [pnlRes, payRes, expRes] = await Promise.all([
        window.api.call('sites.pnl', { site_id: siteId }).catch(function() { return {}; }),
        window.api.call('cpay.list', { site_id: siteId }).catch(function() { return { items: [] }; }),
        window.api.call('exp.list', { site_id: siteId }).catch(function() { return { rows: [] }; })
      ]);

      var pnl = (pnlRes && pnlRes.data) ? pnlRes.data : (pnlRes || {});
      var payments = payRes.items || payRes.rows || [];
      var expenses = expRes.rows || expRes.items || [];

      var marginPct = Number(pnl.profit_margin_pct) || 0;
      var marginColor = marginPct >= 15 ? '#059669' : '#d97706';

      function formatExpDate(d) {
        if (!d) return '';
        var parts = d.split('-');
        if (parts.length === 3) return parts[2] + '-' + parts[1] + '-' + parts[0];
        return d;
      }
      var EXP_CATEGORY_LABELS = { LABOUR:'Labour & Installation', TRANSPORT:'Freight / Local', FOOD_TRAVEL:'Food & Travel', DISCOM_FEES:'Discom / Metering', CIVIL:'Civil / Foundation', WARRANTY_REPLACEMENT:'Warranty Replacement', OTHER:'Other' };

      var nonReversedTotalPaise = expenses.reduce(function(acc, e) {
        var isRev = Boolean(e.is_reversed) || e.status === 'REVERSED';
        return isRev ? acc : acc + (Number(e.amount_paise) || 0);
      }, 0);
      var nonReversedTotalFormatted = '₹' + Math.round(nonReversedTotalPaise / 100).toLocaleString('en-IN');

      moneyEl.innerHTML = `
        <!-- KPI Cards Grid -->
        <div class="kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.75rem; margin-bottom:1rem;">
          <div class="card" style="padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Contract Value</div>
            <div style="font-weight:700; font-size:1.05rem; color:var(--brand);">₹${((Number(pnl.contract_value_paise) || 0) / 100).toLocaleString('en-IN')}</div>
          </div>
          <div class="card" style="padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Total Received</div>
            <div style="font-weight:700; font-size:1.05rem; color:#059669;">₹${((Number(pnl.received_paise) || 0) / 100).toLocaleString('en-IN')}</div>
          </div>
          <div class="card" style="padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Material Cost</div>
            <div style="font-weight:700; font-size:1.05rem; color:#d97706;">₹${((Number(pnl.material_cost_paise) || 0) / 100).toLocaleString('en-IN')}</div>
          </div>
          <div class="card" style="padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Site Expenses</div>
            <div style="font-weight:700; font-size:1.05rem; color:#d97706;">₹${((Number(pnl.expenses_paise) || 0) / 100).toLocaleString('en-IN')}</div>
          </div>
          <div class="card" style="padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Gross Profit</div>
            <div style="font-weight:700; font-size:1.05rem; color:${(Number(pnl.gross_profit_paise) || 0) >= 0 ? '#059669' : '#dc2626'};">
              ₹${((Number(pnl.gross_profit_paise) || 0) / 100).toLocaleString('en-IN')}
            </div>
          </div>
          <div class="card" style="padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Margin / Balance</div>
            <div style="font-weight:700; font-size:1.05rem; color:${marginColor};">${marginPct}%</div>
            <div style="font-size:0.75rem; color:#dc2626; margin-top:2px;">Due: ₹${((Number(pnl.balance_due_paise) || 0) / 100).toLocaleString('en-IN')}</div>
          </div>
        </div>

        <!-- Site Expenses Section -->
        <div class="card" style="margin-bottom:1rem; padding:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h3 style="margin:0; font-size:1rem;">Site Expenses (${expenses.length})</h3>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Total: <strong style="color:var(--brand);">${nonReversedTotalFormatted}</strong></div>
            </div>
            <button id="sdt-add-exp-btn" class="btn btn-primary" style="min-height:36px; padding:0.35rem 0.75rem; font-size:0.85rem;">+ Add Expense</button>
          </div>
          ${expenses.length ? expenses.map(function(exp) {
            var isRev = Boolean(exp.is_reversed) || exp.status === 'REVERSED';
            exp.is_reversed = isRev;
            var categoryLabel = esc(EXP_CATEGORY_LABELS[exp.category] || exp.category || 'Other');
            var formattedDate = esc(formatExpDate(exp.exp_date || exp.expense_date || ''));
            return `
              <div class="card" style="padding:0.75rem;margin-bottom:0.5rem;${exp.is_reversed ? 'opacity:0.6;' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                  <div>
                    <div style="font-weight:600;font-size:0.9rem;${exp.is_reversed ? 'text-decoration:line-through;' : ''}">${categoryLabel} — ${formattedDate}</div>
                    ${exp.paid_to ? '<div style="font-size:0.8rem;color:var(--text-muted);">Paid to: ' + esc(exp.paid_to) + '</div>' : ''}
                    ${exp.mode ? '<div style="font-size:0.8rem;color:var(--text-muted);">Mode: ' + esc(exp.mode) + '</div>' : ''}
                    ${exp.remark ? '<div style="font-size:0.8rem;color:var(--text-muted);">Note: ' + esc(exp.remark) + '</div>' : ''}
                  </div>
                  <div style="text-align:right;">
                    <div style="font-weight:700;color:var(--brand);${exp.is_reversed ? 'text-decoration:line-through;' : ''}">₹${Math.round((Number(exp.amount_paise) || 0) / 100).toLocaleString('en-IN')}</div>
                    ${exp.is_reversed ? '<span class="badge badge-disabled" style="font-size:0.7rem;">Reversed</span>' : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('') : '<p class="text-muted" style="font-size:0.85rem; margin:0;">No expenses recorded for this site yet.</p>'}
        </div>

        <!-- Customer Payments Section -->
        <div class="card" style="padding:1rem;">
          <h3 style="margin:0 0 0.75rem 0; font-size:1rem;">Customer Payments (${payments.length})</h3>
          ${payments.length ? payments.map(function(p) {
            var isRev = p.status === 'REVERSED';
            return `
              <div class="card" style="margin-bottom:0.5rem; padding:0.75rem; background:var(--bg-main);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-weight:600; font-size:0.95rem;">₹${((Number(p.amount_paise) || 0) / 100).toLocaleString('en-IN')}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${esc(p.type || p.payment_type || 'PAYMENT')} · ${esc(p.mode || '')} · ${esc(p.pay_date || p.payment_date || '')}</div>
                  </div>
                  <span class="badge ${isRev ? 'badge-danger' : 'badge-success'}">${esc(p.status || 'ACTIVE')}</span>
                </div>
              </div>
            `;
          }).join('') : '<p class="text-muted" style="font-size:0.85rem; margin:0;">No payments received for this site yet.</p>'}
        </div>
      `;

      _bindMoneyEvents(pane);
      _tabData['money'] = pane.innerHTML;
      _tabLoaded['money'] = true;
    } catch(e) {
      if (moneyEl) moneyEl.innerHTML = `<div class="card text-error">${esc(e.message || 'Failed to load financial data')}</div>`;
    }
  }

  function _bindMoneyEvents(pane) {
    var mgrAddBtn = pane.querySelector('#sdt-mgr-add-exp-btn');
    if (mgrAddBtn) {
      mgrAddBtn.onclick = function() {
        openAddExpenseSheet(siteId);
      };
    }
    var addExpBtn = pane.querySelector('#sdt-add-exp-btn');
    if (addExpBtn) {
      addExpBtn.onclick = function() {
        openAddExpenseSheet(siteId);
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Add Site Expense Bottom Sheet (P1-5)
  // ---------------------------------------------------------------------------
  function openAddExpenseSheet(siteId) {
    var formHtml = `
      <form id="sdt-exp-form" novalidate>
        <div class="form-field">
          <label>Category *</label>
          <select id="sdt-ef-category" class="input" required>
            <option value="LABOUR">LABOUR (Labour & Installation)</option>
            <option value="TRANSPORT">TRANSPORT (Freight / Local)</option>
            <option value="FOOD_TRAVEL">FOOD_TRAVEL (Food & Travel)</option>
            <option value="DISCOM_FEES">DISCOM_FEES (Discom / Metering)</option>
            <option value="CIVIL">CIVIL (Civil / Foundation Work)</option>
            <option value="WARRANTY_REPLACEMENT">WARRANTY_REPLACEMENT</option>
            <option value="OTHER" selected>OTHER (Miscellaneous)</option>
          </select>
        </div>
        <div class="form-field">
          <label>Amount (₹) *</label>
          <input type="number" id="sdt-ef-amount" class="input" placeholder="e.g. 2500" min="1" step="0.01" required>
        </div>
        <div class="form-field">
          <label>Expense Date *</label>
          <input type="date" id="sdt-ef-date" class="input" value="${new Date().toISOString().slice(0, 10)}" required>
        </div>
        <div class="form-field">
          <label>Paid To</label>
          <input type="text" id="sdt-ef-paidto" class="input" placeholder="e.g. Raju Electrician">
        </div>
        <div class="form-field">
          <label>Payment Mode</label>
          <select id="sdt-ef-mode" class="input">
            <option value="CASH" selected>CASH</option>
            <option value="UPI">UPI</option>
            <option value="BANK">BANK (NEFT/RTGS/IMPS)</option>
            <option value="CHEQUE">CHEQUE</option>
          </select>
        </div>
        <div class="form-field">
          <label>Remark / Notes</label>
          <textarea id="sdt-ef-remark" class="input" rows="2" placeholder="Details of expense"></textarea>
        </div>
        <div id="sdt-ef-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="sdt-ef-submit" class="btn btn-primary btn-full">Save Expense</button>
      </form>
    `;

    window.ui.openBottomSheet('Add Site Expense', formHtml, '');

    document.getElementById('sdt-exp-form').onsubmit = async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('sdt-ef-error');
      var submitBtn = document.getElementById('sdt-ef-submit');
      errEl.style.display = 'none';

      var inr = parseFloat(document.getElementById('sdt-ef-amount').value);
      if (!inr || inr <= 0) {
        errEl.textContent = 'Please enter a valid amount greater than 0';
        errEl.style.display = 'block';
        return;
      }

      var payload = {
        site_id: siteId,
        category: document.getElementById('sdt-ef-category').value,
        amount_paise: Math.round(inr * 100),
        exp_date: document.getElementById('sdt-ef-date').value,
        paid_to: document.getElementById('sdt-ef-paidto').value.trim(),
        mode: document.getElementById('sdt-ef-mode').value,
        remark: document.getElementById('sdt-ef-remark').value.trim()
      };

      window.ui.withButtonLoading(submitBtn, async function() {
        try {
          await window.api.call('exp.add', payload);
          window.ui.closeBottomSheet();
          window.ui.toast('Site expense recorded successfully', 'success');
          delete _tabLoaded['money'];
          delete _tabData['money'];
          if (currentTab === 'money') renderCurrentTab();
        } catch(err) {
          errEl.textContent = err.message || 'Failed to save expense';
          errEl.style.display = 'block';
        }
      });
    };
  }

  // ---------------------------------------------------------------------------
  // Manual Site Status Control Dialog (P2-4)
  // ---------------------------------------------------------------------------
  function openSiteStatusDialog() {
    var formHtml = `
      <form id="sdt-set-status-form" novalidate>
        <p class="text-muted" style="margin:0 0 1rem 0;">Current Status: <strong>${siteData.status}</strong></p>
        <div class="form-field">
          <label>Target Status *</label>
          <select id="ss-status" class="input" required>
            <option value="ACTIVE" ${siteData.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE (Ongoing project)</option>
            <option value="ON_HOLD" ${siteData.status === 'ON_HOLD' ? 'selected' : ''}>ON_HOLD (Temporarily paused)</option>
            <option value="COMPLETED" ${siteData.status === 'COMPLETED' ? 'selected' : ''}>COMPLETED (All work finished)</option>
            <option value="CANCELLED" ${siteData.status === 'CANCELLED' ? 'selected' : ''}>CANCELLED (Terminated)</option>
          </select>
        </div>
        <div class="form-field" id="ss-reason-wrap">
          <label>Reason / Remark</label>
          <input type="text" id="ss-reason" class="input" placeholder="e.g. Work paused awaiting client payment">
        </div>
        <div id="ss-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
        <button type="submit" id="ss-submit" class="btn btn-primary btn-full">Save Site Status</button>
      </form>
    `;

    window.ui.openBottomSheet('Change Status: ' + siteData.site_name, formHtml, '');

    document.getElementById('sdt-set-status-form').onsubmit = async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('ss-error');
      var submitBtn = document.getElementById('ss-submit');
      errEl.style.display = 'none';

      var newStat = document.getElementById('ss-status').value;
      var reason = document.getElementById('ss-reason').value.trim();

      window.ui.withButtonLoading(submitBtn, async function() {
        try {
          await window.api.call('sites.setStatus', {
            site_id: siteData.site_id,
            status: newStat,
            reason: reason
          });
          window.ui.closeBottomSheet();
          window.ui.toast('Site status updated to ' + newStat, 'success');
          await loadDetails();
        } catch(err) {
          errEl.textContent = err.message || 'Failed to update status';
          errEl.style.display = 'block';
        }
      });
    };
  }

  function openAssignUsersSheet() {
    window.api.call('users.list', {}).then(function(uRes) {
      var allUsers = (uRes && uRes.items || []).filter(function(u) { return u.role === 'SITE_USER' && u.is_active !== false; });
      var assignedIds = (assignedUsersData || []).map(function(u) { return u.user_id; });
      var formHtml = '<form id="sdt-assign-form" novalidate>' +
        '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.75rem;">Select site users to assign to this site:</p>' +
        '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem;">' +
        allUsers.map(function(u) {
          var isChecked = assignedIds.indexOf(u.user_id) !== -1 ? ' checked' : '';
          return '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;">' +
            '<input type="checkbox" value="' + window.ui.esc(u.user_id) + '"' + isChecked + ' style="width:18px;height:18px;"> ' +
            window.ui.esc(u.name) + ' <span style="font-size:0.75rem;color:var(--text-muted);">@' + window.ui.esc(u.username || '') + '</span>' +
            '</label>';
        }).join('') +
        '</div>' +
        '<button type="submit" id="sdt-assign-submit" class="btn btn-primary btn-full">Save Assignments</button>' +
        '</form>';
      window.ui.openBottomSheet('Assign Site Users', formHtml, '');
      var form = document.getElementById('sdt-assign-form');
      if (form) form.onsubmit = function(e) {
        e.preventDefault();
        var checked = Array.from(document.querySelectorAll('#sdt-assign-form input[type=checkbox]:checked')).map(function(cb) { return cb.value; });
        window.ui.withButtonLoading(document.getElementById('sdt-assign-submit'), async function() {
          try {
            await window.api.call('sites.assignUsers', { site_id: siteId, user_ids: checked });
            window.ui.closeBottomSheet();
            window.ui.toast('Users assigned', 'success');
            assignedUsersData = allUsers.filter(function(u) { return checked.indexOf(u.user_id) !== -1; });
            var assignedEl = document.getElementById('sdt-assigned-list');
            if (assignedEl) {
              if (!assignedUsersData.length) {
                assignedEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.875rem;">No users assigned</span>';
              } else {
                assignedEl.innerHTML = assignedUsersData.map(function(u) {
                  return '<span class="badge" style="margin-right:0.35rem;">' + window.ui.esc(u.name || u.user_id) + '</span>';
                }).join('');
              }
            }
          } catch(err) { window.ui.toast(err.message || 'Failed', 'error'); }
        });
      };
    }).catch(function(err) { window.ui.toast(err.message || 'Could not load users', 'error'); });
  }

  // 5. Info Tab (P2-5: Show names primary, raw IDs secondary)
  function renderInfoTab(pane) {
    var custDisplayName = siteData.customer_name || (customerData ? customerData.name : '');
    var custPhone = customerData ? customerData.phone : '';
    var branchDisplayName = siteData.branch_name || siteData.branch_id || 'MAIN';
    var locDisplayName = siteData.location_name || siteData.default_location_id || 'LOC-MAIN';

    pane.innerHTML = `
      <div class="card" style="padding:1rem;">
        <h3 style="margin-top:0; font-size:1.05rem;">Project Details</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; font-size:0.875rem;">
          <div>
            <span class="text-muted">Customer:</span><br>
            <strong>${esc(custDisplayName || 'N/A')}</strong>
            ${custPhone ? `<div style="font-size:0.75rem; color:var(--text-muted);">${esc(custPhone)}</div>` : ''}
            ${siteData.customer_id ? `<div style="font-size:0.7rem; color:var(--text-muted);">${esc(siteData.customer_id)}</div>` : ''}
          </div>
          <div>
            <span class="text-muted">Site ID:</span><br>
            <strong>${esc(siteData.site_id)}</strong>
          </div>
          <div>
            <span class="text-muted">Branch:</span><br>
            <strong>${esc(branchDisplayName)}</strong>
            ${siteData.branch_id && siteData.branch_id !== branchDisplayName ? `<div style="font-size:0.7rem; color:var(--text-muted);">${esc(siteData.branch_id)}</div>` : ''}
          </div>
          <div>
            <span class="text-muted">Godown Location:</span><br>
            <strong>${esc(locDisplayName)}</strong>
            ${siteData.default_location_id && siteData.default_location_id !== locDisplayName ? `<div style="font-size:0.7rem; color:var(--text-muted);">${esc(siteData.default_location_id)}</div>` : ''}
          </div>
          <div>
            <span class="text-muted">Capacity:</span><br>
            <strong>${esc(siteData.system_kw || '0')} kW</strong>
          </div>
          <div>
            <span class="text-muted">Target Date:</span><br>
            <strong>${esc(siteData.target_date || 'N/A')}</strong>
          </div>
          <div style="grid-column:1 / -1;"><span class="text-muted">Address:</span><br><strong>${esc(siteData.address || 'N/A')}</strong></div>
          <div style="grid-column:1 / -1;"><span class="text-muted">Created On:</span><br><strong>${esc(siteData.created_at || 'N/A')}</strong></div>
        </div>
      </div>
    `;

    // B1: Contract value edit (OWNER/DEVELOPER see current; MANAGER write-only)
    if (isOwner || userRole === 'MANAGER') {
      var cvDiv = document.createElement('div');
      cvDiv.className = 'card';
      cvDiv.style.cssText = 'padding:1rem;margin-top:1rem;';
      var currentVal = isOwner ? ((Number(siteData.contract_value_paise) || 0) / 100) : null;
      cvDiv.innerHTML = '<h3 style="margin:0 0 0.75rem;font-size:1.05rem;">Contract Value</h3>' +
        '<form id="sdt-cv-form" novalidate>' +
        '<div class="form-field">' +
        (isOwner
          ? '<label>Value (\u20b9) — current: <strong>\u20b9' + (currentVal ? currentVal.toLocaleString('en-IN') : '0') + '</strong></label>'
          : '<label>Value (\u20b9) <span style="font-size:0.75rem;color:var(--text-muted);">(current amount hidden for your role)</span></label>') +
        '<input type="number" id="sdt-cv-input" class="input" min="0" step="1" placeholder="Enter amount in rupees"' +
        (isOwner && currentVal ? ' value="' + currentVal + '"' : '') + '>' +
        '</div>' +
        '<div id="sdt-cv-error" class="text-error" style="display:none;margin-bottom:0.5rem;"></div>' +
        '<button type="submit" id="sdt-cv-submit" class="btn btn-primary" style="min-height:44px;">Save Contract Value</button>' +
        '</form>';
      pane.appendChild(cvDiv);
      document.getElementById('sdt-cv-form').onsubmit = function(e) {
        e.preventDefault();
        var errEl = document.getElementById('sdt-cv-error');
        var inp = document.getElementById('sdt-cv-input');
        var rupees = parseFloat(inp.value);
        if (isNaN(rupees) || rupees < 0) {
          errEl.textContent = 'Enter a valid amount';
          errEl.style.display = 'block';
          return;
        }
        errEl.style.display = 'none';
        var paise = Math.round(rupees * 100);
        window.ui.withButtonLoading(document.getElementById('sdt-cv-submit'), function() {
          return window.api.call('sites.update', { site_id: siteId, contract_value_paise: paise })
            .then(function() {
              window.ui.toast('Contract value saved', 'success');
              if (isOwner) siteData.contract_value_paise = paise;
            })
            .catch(function(err) {
              errEl.textContent = err.message || 'Failed to save';
              errEl.style.display = 'block';
            });
        });
      };
    }

    // B8: Assigned users section (OWNER/MANAGER/DEVELOPER only)
    if (isOwner || userRole === 'MANAGER') {
      var assignedDiv = document.createElement('div');
      assignedDiv.className = 'card';
      assignedDiv.style.cssText = 'padding:1rem;margin-top:1rem;';
      assignedDiv.innerHTML = '<h3 style="margin:0 0 0.75rem;font-size:1.05rem;">Assigned Users</h3><div id="sdt-assigned-list"><span class="spinner"></span></div><button id="sdt-assign-btn" class="btn btn-secondary" style="margin-top:0.75rem;min-height:44px;">Manage Assignments</button>';
      pane.appendChild(assignedDiv);
      var assignedEl = document.getElementById('sdt-assigned-list');
      if (assignedEl) {
        if (!assignedUsersData.length) {
          assignedEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.875rem;">No users assigned</span>';
        } else {
          assignedEl.innerHTML = assignedUsersData.map(function(u) {
            return '<span class="badge" style="margin-right:0.35rem;">' + window.ui.esc(u.name || u.user_id) + '</span>';
          }).join('');
        }
      }
      var assignBtn = document.getElementById('sdt-assign-btn');
      if (assignBtn) {
        assignBtn.onclick = function() { openAssignUsersSheet(); };
      }
    }
  }


  // ---------------------------------------------------------------------------
  // Issue Material Bottom Sheet
  // ---------------------------------------------------------------------------
  async function openIssueMaterialSheet() {
    await ensureProductsLoaded();
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

      window.ui.withButtonLoading(submitBtn, async function() {
        try {
          await window.api.call('usage.issue', {
            site_id: siteId,
            location_id: siteData.default_location_id || 'LOC-MAIN',
            used_on: document.getElementById('sdt-if-date').value,
            lines: [line]
          });
          window.ui.closeBottomSheet();
          window.ui.toast('Materials issued successfully', 'success');
          delete _tabLoaded['material'];
          delete _tabData['material'];
          delete _tabLoaded['serials'];
          delete _tabData['serials'];
          if (currentTab === 'material' || currentTab === 'serials') renderCurrentTab();
        } catch(err) {
          errEl.textContent = err.message || 'Failed to issue material';
          errEl.style.display = 'block';
        }
      });
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
  // Update Stage Bottom Sheet (Doc 06 S07 + S12 Multi-Photo & Gallery Integration)
  // ---------------------------------------------------------------------------
  function openUpdateStageDialog(site, stg, sm) {
    var stageName = sm.name_en || stg.stage_id;
    var isReqPhoto = sm.requires_photo === true || sm.requires_photo === 'TRUE' || sm.requires_photo === 1;

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

        <!-- 1. Already Uploaded Stage Photos (Always visible to all) -->
        <div id="usf-existing-section" style="margin-top:0.75rem; padding:0.6rem 0.75rem; background:var(--card-bg,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <strong style="font-size:0.85rem; display:flex; align-items:center; gap:0.35rem;">
              <span>📷 Existing Stage Photos</span>
              <span id="usf-existing-count-badge" class="badge badge-secondary" style="font-size:0.7rem; font-weight:700;">0</span>
            </strong>
            <span style="font-size:0.7rem; color:var(--text-muted);">Tap thumbnail to view</span>
          </div>
          <div id="usf-existing-grid" style="display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.35rem; min-height:40px; align-items:center;">
            <span style="font-size:0.75rem; color:var(--text-muted);">Checking existing photos...</span>
          </div>
        </div>

        <!-- 2. Attach New Photo(s) -->
        <div class="form-field" style="margin-top:0.75rem; padding:0.6rem 0.75rem; background:var(--card-bg,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:6px;">
          <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem; font-weight:600;">
            <span>Attach New Photo(s) ${isReqPhoto ? '<span class="text-error" style="font-weight:700;">* (Mandatory to complete)</span>' : '<span class="text-muted">(Optional)</span>'}</span>
            <span id="usf-staged-count-badge" style="font-size:0.75rem; color:var(--brand,#059669); font-weight:700;"></span>
          </label>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem;">
            ${isReqPhoto ? 'Photo proof is required to mark this stage COMPLETED.' : 'Capture or select multiple photos for this stage.'}
          </div>

          <input type="file" id="usf-gallery-input" accept="image/*" multiple style="display:none;">
          <input type="file" id="usf-camera-input" accept="image/*" capture="environment" style="display:none;">

          <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
            <button type="button" id="usf-btn-camera" class="btn btn-secondary btn-sm" style="display:flex; align-items:center; gap:0.35rem;">
              📷 <span>Take Photo</span>
            </button>
            <button type="button" id="usf-btn-gallery" class="btn btn-secondary btn-sm" style="display:flex; align-items:center; gap:0.35rem;">
              📁 <span>Gallery / Multi-Select</span>
            </button>
            <button type="button" id="usf-btn-upload-now" class="btn btn-primary btn-sm" style="display:none; align-items:center; gap:0.35rem; background:var(--brand,#059669); color:#fff;" title="Upload without changing stage status">
              📤 <span>Upload Photos Now</span>
            </button>
          </div>

          <!-- Staged Previews Grid -->
          <div id="usf-staged-grid" style="display:none; margin-top:0.6rem; display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.35rem;"></div>
        </div>

        <div id="usf-error" class="text-error" style="display:none; margin-bottom:0.75rem; margin-top:0.5rem;"></div>
        <button type="submit" id="usf-submit" class="btn btn-primary btn-full">Save Stage Status</button>
      </form>
    `;

    window.ui.openBottomSheet('Update: ' + stageName, formHtml, '');

    var statusSelect = document.getElementById('usf-status');
    var reasonWrap = document.getElementById('usf-reason-wrap');
    var galleryInput = document.getElementById('usf-gallery-input');
    var cameraInput = document.getElementById('usf-camera-input');
    var btnCamera = document.getElementById('usf-btn-camera');
    var btnGallery = document.getElementById('usf-btn-gallery');
    var btnUploadNow = document.getElementById('usf-btn-upload-now');
    var existingGrid = document.getElementById('usf-existing-grid');
    var existingBadge = document.getElementById('usf-existing-count-badge');
    var stagedGrid = document.getElementById('usf-staged-grid');
    var stagedBadge = document.getElementById('usf-staged-count-badge');
    var errEl = document.getElementById('usf-error');
    var submitBtn = document.getElementById('usf-submit');

    var stagedPhotos = [];
    var existingPhotos = [];

    function renderExisting(photos) {
      existingPhotos = photos || [];
      if (!existingGrid) return;
      if (existingBadge) existingBadge.textContent = String(existingPhotos.length);

      if (!existingPhotos.length) {
        existingGrid.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted); padding:0.25rem 0;">No photos uploaded for this stage yet.</span>';
        return;
      }

      existingGrid.innerHTML = existingPhotos.map(function(p) {
        var canDelete = (isOwner || userRole === 'MANAGER' || (userRole === 'SITE_USER' && p.uploaded_by === currentUserId));
        return `
          <div class="existing-photo-item" data-photo-id="${esc(p.photo_id)}" data-caption="${esc(p.caption || '')}" data-date="${esc(p.uploaded_at || '')}" style="position:relative; width:80px; height:80px; flex-shrink:0; border-radius:6px; overflow:hidden; border:1px solid var(--border,#cbd5e1); cursor:pointer; background:#f1f5f9;" title="${esc(p.caption || 'Stage Photo')}">
            <div id="esk-${esc(p.photo_id)}" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#e2e8f0;">
              <span style="font-size:1rem; opacity:0.3;">📸</span>
            </div>
            <img id="eimg-${esc(p.photo_id)}" alt="Photo" style="display:none; width:100%; height:100%; object-fit:cover;" />
            <span style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.65); color:#fff; font-size:0.55rem; text-align:center; padding:1px 0;">View ↗</span>
            ${canDelete ? `
              <button type="button" class="btn-del-existing" data-photo-id="${esc(p.photo_id)}" style="position:absolute; top:2px; right:2px; background:rgba(220,38,38,0.9); color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
            ` : ''}
          </div>
        `;
      }).join('');

      existingGrid.querySelectorAll('.existing-photo-item').forEach(function(item) {
        item.onclick = function(ev) {
          if (ev.target.closest('.btn-del-existing')) return;
          var pId = item.getAttribute('data-photo-id');
          var caption = item.getAttribute('data-caption') || '';
          var date = item.getAttribute('data-date') || '';
          openFullPhotoModal(pId, caption, date);
        };
      });

      async function refreshStageExistingPhotos() {
        _tabLoaded['photos'] = false;
        var freshRes = await window.api.call('photos.list', { site_id: site.site_id });
        if (freshRes && freshRes.photos) {
          sitePhotosData = freshRes.photos;
          var freshMatches = freshRes.photos.filter(function(p) {
            return p.stage_id === stg.stage_id && !p.archived && p.is_active !== false;
          });
          renderExisting(freshMatches);
        }
        loadDetails();
      }

      existingGrid.querySelectorAll('.btn-del-existing').forEach(function(delBtn) {
        delBtn.onclick = function(ev) {
          ev.stopPropagation();
          var pId = delBtn.getAttribute('data-photo-id');
          openDeletePhotoDialog(pId, refreshStageExistingPhotos);
        };
      });

      existingPhotos.forEach(function(p) {
        var imgEl = document.getElementById('eimg-' + p.photo_id);
        var skelEl = document.getElementById('esk-' + p.photo_id);
        if (imgEl) loadPhotoThumb(p.photo_id, imgEl, skelEl);
      });
    }

    var initialMatches = (sitePhotosData || []).filter(function(p) {
      return p.stage_id === stg.stage_id && !p.archived && p.is_active !== false;
    });
    renderExisting(initialMatches);

    window.api.call('photos.list', { site_id: site.site_id }).then(function(res) {
      if (res && res.photos) {
        sitePhotosData = res.photos;
        var freshMatches = res.photos.filter(function(p) {
          return p.stage_id === stg.stage_id && !p.archived && p.is_active !== false;
        });
        renderExisting(freshMatches);
      }
    }).catch(function() {});

    function renderStaged() {
      if (!stagedGrid) return;
      if (!stagedPhotos.length) {
        stagedGrid.style.display = 'none';
        stagedGrid.innerHTML = '';
        if (stagedBadge) stagedBadge.textContent = '';
        if (btnUploadNow) btnUploadNow.style.display = 'none';
        return;
      }
      stagedGrid.style.display = 'flex';
      if (btnUploadNow) btnUploadNow.style.display = 'inline-flex';
      if (stagedBadge) stagedBadge.textContent = stagedPhotos.length + ' photo' + (stagedPhotos.length > 1 ? 's' : '') + ' ready';

      stagedGrid.innerHTML = stagedPhotos.map(function(p, idx) {
        return `
          <div style="position:relative; width:80px; height:80px; flex-shrink:0; border-radius:6px; overflow:hidden; border:1px solid var(--brand,#059669); background:#000;">
            <img src="data:${p.mimeType};base64,${p.base64}" alt="Preview" style="width:100%; height:100%; object-fit:cover;" />
            <button type="button" class="btn-remove-staged" data-idx="${idx}" style="position:absolute; top:2px; right:2px; background:rgba(220,38,38,0.85); color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:11px; cursor:pointer; line-height:20px; text-align:center;">✕</button>
            <span style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.65); color:#fff; font-size:0.55rem; padding:1px 2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center;">${esc(p.fileName)}</span>
          </div>
        `;
      }).join('');

      stagedGrid.querySelectorAll('.btn-remove-staged').forEach(function(btn) {
        btn.onclick = function() {
          var removeIdx = parseInt(btn.getAttribute('data-idx'), 10);
          stagedPhotos.splice(removeIdx, 1);
          renderStaged();
        };
      });
    }

    async function handleFilesSelected(fileList) {
      if (!fileList || !fileList.length) return;
      var newFiles = Array.from(fileList);
      btnCamera.disabled = true;
      btnGallery.disabled = true;
      var origText = btnGallery.innerHTML;
      btnGallery.textContent = 'Processing (' + newFiles.length + ')...';

      try {
        for (var i = 0; i < newFiles.length; i++) {
          var f = newFiles[i];
          var comp = await compressPhotoAndThumb(f);
          if (comp) {
            var fileName = formatPhotoFileName(site.site_name, stagedPhotos.length, stagedPhotos.length + 1);
            stagedPhotos.push({
              file: f,
              base64: comp.base64,
              thumbBase64: comp.thumbBase64,
              mimeType: comp.mimeType || 'image/jpeg',
              fileName: fileName
            });
          }
        }
        renderStaged();
      } catch (err) {
        errEl.textContent = 'Failed to process image: ' + (err.message || err);
        errEl.style.display = 'block';
      } finally {
        btnCamera.disabled = false;
        btnGallery.disabled = false;
        btnGallery.innerHTML = origText;
        galleryInput.value = '';
        cameraInput.value = '';
      }
    }

    btnCamera.onclick = function() { cameraInput.click(); };
    btnGallery.onclick = function() { galleryInput.click(); };

    if (btnUploadNow) {
      btnUploadNow.onclick = async function() {
        if (!stagedPhotos.length) return;
        window.ui.withButtonLoading(btnUploadNow, async function() {
          try {
            errEl.style.display = 'none';
            for (var i = 0; i < stagedPhotos.length; i++) {
              var p = stagedPhotos[i];
              btnUploadNow.textContent = 'Uploading (' + (i + 1) + '/' + stagedPhotos.length + ')...';
              await window.api.call('photos.upload', {
                site_id:           site.site_id,
                stage_id:          stg.stage_id,
                caption:           (sm.name_en || stg.stage_id) + ' proof (' + (i + 1) + '/' + stagedPhotos.length + ')',
                data_base64:       p.base64,
                thumb_data_base64: p.thumbBase64,
                mime_type:         p.mimeType,
                file_name:         p.fileName
              });
            }
            var count = stagedPhotos.length;
            stagedPhotos = [];
            renderStaged();
            _tabLoaded['photos'] = false;
            window.ui.toast(count + ' photo(s) uploaded successfully! 📸', 'success');

            // Refresh existing photos immediately
            var freshRes = await window.api.call('photos.list', { site_id: site.site_id });
            if (freshRes && freshRes.photos) {
              sitePhotosData = freshRes.photos;
              var freshMatches = freshRes.photos.filter(function(p) {
                return p.stage_id === stg.stage_id && !p.archived && p.is_active !== false;
              });
              renderExisting(freshMatches);
            }
            loadDetails();
          } catch(uploadErr) {
            errEl.textContent = 'Upload failed: ' + (uploadErr.message || uploadErr);
            errEl.style.display = 'block';
          } finally {
            btnUploadNow.innerHTML = '📤 <span>Upload Photos Now</span>';
          }
        });
      };
    }

    cameraInput.onchange = function() { handleFilesSelected(cameraInput.files); };
    galleryInput.onchange = function() { handleFilesSelected(galleryInput.files); };

    statusSelect.onchange = function() {
      reasonWrap.style.display = statusSelect.value === 'BLOCKED' ? 'block' : 'none';
    };

    document.getElementById('update-stage-form').onsubmit = async function(e) {
      e.preventDefault();
      errEl.style.display = 'none';

      var toStatus = statusSelect.value;
      var reason = document.getElementById('usf-reason').value.trim();
      var remark = document.getElementById('usf-remark').value.trim();

      if (toStatus === 'BLOCKED' && !reason) {
        errEl.textContent = 'Reason is required when marking stage BLOCKED';
        errEl.style.display = 'block';
        return;
      }

      if (stg.status === 'COMPLETED' && toStatus !== 'COMPLETED' && !remark) {
        errEl.textContent = 'Remark is required when moving away from COMPLETED status';
        errEl.style.display = 'block';
        return;
      }

      // Enforce requires_photo when marking stage COMPLETED
      if (toStatus === 'COMPLETED' && isReqPhoto) {
        if (!stagedPhotos.length && (!existingPhotos || !existingPhotos.length)) {
          errEl.textContent = 'Photo proof is required to mark this stage as COMPLETED. Please attach or capture at least one photo.';
          errEl.style.display = 'block';
          return;
        }
      }

      window.ui.withButtonLoading(submitBtn, async function() {
        try {
          if (stagedPhotos.length > 0) {
            for (var i = 0; i < stagedPhotos.length; i++) {
              var p = stagedPhotos[i];
              submitBtn.textContent = 'Uploading (' + (i + 1) + '/' + stagedPhotos.length + ')...';
              await window.api.call('photos.upload', {
                site_id:     site.site_id,
                stage_id:    stg.stage_id,
                caption:     (sm.name_en || stg.stage_id) + ' proof (' + (i + 1) + '/' + stagedPhotos.length + ')',
                data_base64: p.base64,
                mime_type:   p.mimeType,
                file_name:   p.fileName
              });
            }
            _tabLoaded['photos'] = false;
          }

          submitBtn.textContent = 'Saving stage...';
          await window.api.call('stages.update', {
            site_id:      site.site_id,
            stage_id:     stg.stage_id,
            status:       toStatus,
            block_reason: reason,
            remark:       remark
          });
          window.ui.closeBottomSheet();
          window.ui.toast(stagedPhotos.length > 0 ? ('Stage updated and ' + stagedPhotos.length + ' photo(s) uploaded!') : 'Stage updated', 'success');
          await loadDetails();

          // P2-2: Prompt ONLY for "Material Dispatched" (seq 5)
          var isSeq5 = Number(stg.seq) === 5 || Number(sm.seq) === 5 || stageName === 'Material Dispatched';
          if (isSeq5 && (toStatus === 'IN_PROGRESS' || toStatus === 'COMPLETED')) {
            promptStageMaterial(stageName);
          }
        } catch(err) {
          errEl.textContent = err.message || 'Update failed';
          errEl.style.display = 'block';
        }
      });
    };
  }

  await loadDetails();
};
