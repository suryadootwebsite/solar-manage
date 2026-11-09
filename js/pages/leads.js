/**
 * leads.js — Leads Pipeline & Customer Conversion Screen (S14).
 *
 * Implements:
 *   - Status filter buttons (same style as sites.js — btn-primary/btn-secondary).
 *   - Search bar via shared list-search component.
 *   - Today / Overdue follow-up highlights.
 *   - Direct call (tel:) & WhatsApp (wa.me) links.
 *   - Add / Edit Lead bottom sheet (with Address, Quotation Amount & optional Photo).
 *   - Notes timeline bottom sheet.
 *   - Convert to Customer & Site modal (with Cash / Finance Stage Track).
 */

window.pages = window.pages || {};

window.pages.leads = async function (container) {
  var t = (window.i18n && window.i18n.t) ? window.i18n.t : function (k) { return k; };
  var esc = (window.ui && window.ui.esc) ? window.ui.esc : function (s) { return String(s || ''); };

  var user = (window.auth && window.auth.getUser) ? window.auth.getUser() : {};
  var isOwnerOrManager = user.role === 'OWNER' || user.role === 'MANAGER';

  if (!isOwnerOrManager) {
    container.innerHTML = '<div class="card text-danger" style="padding:2rem;text-align:center;">' +
      'Access denied. Leads pipeline is restricted to Owner and Manager.</div>';
    return;
  }

  // ── Status labels
  var STATUS_LABELS = {
    ALL: 'All', NEW: 'New', CONTACTED: 'Contacted', SITE_VISIT: 'Site Visit',
    QUOTATION_SENT: 'Quote', NEGOTIATION: 'Negotiation', WON: 'Won', LOST: 'Lost'
  };
  var STATUS_LIST = ['NEW', 'CONTACTED', 'SITE_VISIT', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST'];

  // ── Build filter row (same btn style as sites.js)
  var filterBtns = ['ALL'].concat(STATUS_LIST).map(function (st, idx) {
    var isActive = idx === 0;
    return '<button type="button" class="btn ' + (isActive ? 'btn-primary' : 'btn-secondary') +
      ' lead-filter-btn" data-status="' + st + '" style="padding:0.35rem 0.75rem;font-size:0.8rem;min-height:36px;white-space:nowrap;">' +
      STATUS_LABELS[st] + ' <span id="lcount-' + st + '" style="opacity:0.75;">0</span>' +
      '</button>';
  }).join('');

  container.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">' +
      '<div>' +
        '<h2 style="margin:0;font-size:1.35rem;">' + esc(t('leads.title') || 'Leads') + '</h2>' +
        '<p class="text-muted" style="margin:0.2rem 0 0;font-size:0.85rem;">' + esc(t('leads.subtitle') || 'Customer inquiries, quotations & conversions') + '</p>' +
      '</div>' +
      '<button id="btn-add-lead" class="btn btn-primary" style="min-height:42px;">+ ' + esc(t('leads.new_btn') || 'Add Lead') + '</button>' +
    '</div>' +

    '<div id="leads-search-mount"></div>' +

    // ── Filter bar: same scroll-row as sites
    '<div style="display:flex;gap:0.4rem;overflow-x:auto;padding-bottom:0.5rem;margin-bottom:0.75rem;-webkit-overflow-scrolling:touch;scrollbar-width:none;">' +
      filterBtns +
    '</div>' +

    '<div id="leads-list-view">' +
      '<div style="text-align:center;padding:2rem;"><span class="spinner"></span></div>' +
    '</div>';

  var allLeads = [];
  var currentStatus = 'ALL';
  var searchQuery = '';
  var today = new Date().toISOString().split('T')[0];

  var listView = document.getElementById('leads-list-view');
  var searchMount = document.getElementById('leads-search-mount');

  // Shared Search Bar
  if (window.components && window.components.createSearchBar) {
    var searchBar = window.components.createSearchBar({
      placeholder: t('leads.search_placeholder') || 'Search name, phone, city...',
      onSearch: function (q) {
        searchQuery = q;
        renderLeadsList();
      }
    });
    searchMount.appendChild(searchBar.element);
  }

  // Filter button clicks — same logic as sites.js
  var filterButtons = container.querySelectorAll('.lead-filter-btn');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) {
        b.classList.remove('active', 'btn-primary');
        b.classList.add('btn-secondary');
      });
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-secondary');
      currentStatus = btn.getAttribute('data-status');
      renderLeadsList();
    });
  });

  // Load Leads
  async function loadLeads() {
    try {
      var res = await window.api.call('leads.list', { limit: 200 });
      allLeads = (res && res.leads) || [];
      updateStatusCounts();
      renderLeadsList();
    } catch (err) {
      listView.innerHTML = '<div class="card text-danger" style="padding:1rem;text-align:center;">Failed to load leads: ' + esc(err.message || 'Error') + '</div>';
    }
  }

  function updateStatusCounts() {
    var counts = { ALL: allLeads.length };
    STATUS_LIST.forEach(function (st) { counts[st] = 0; });
    allLeads.forEach(function (l) {
      if (counts[l.status] !== undefined) counts[l.status]++;
    });
    for (var st in counts) {
      var el = document.getElementById('lcount-' + st);
      if (el) el.textContent = counts[st];
    }
  }

  function renderLeadsList() {
    var filtered = allLeads;
    if (currentStatus !== 'ALL') {
      filtered = filtered.filter(function (l) { return l.status === currentStatus; });
    }
    if (searchQuery && window.components && window.components.filterListByQuery) {
      filtered = window.components.filterListByQuery(filtered, searchQuery,
        ['name', 'phone', 'alt_phone', 'city', 'address', 'interest', 'remark', 'lead_id']);
    }

    if (!filtered.length) {
      listView.innerHTML = '<div class="card text-muted" style="text-align:center;padding:2rem;">' +
        esc(t('leads.empty') || 'No leads found') + '</div>';
      return;
    }

    listView.innerHTML = filtered.map(function (lead) {
      var statusBadgeClass = 'badge-primary';
      if (lead.status === 'WON') statusBadgeClass = 'badge-success';
      else if (lead.status === 'LOST') statusBadgeClass = 'badge-danger';
      else if (lead.status === 'NEW') statusBadgeClass = 'badge-warning';

      var isFollowupToday = lead.next_followup_date === today && lead.status !== 'WON' && lead.status !== 'LOST';
      var isOverdue = lead.next_followup_date && lead.next_followup_date < today && lead.status !== 'WON' && lead.status !== 'LOST';

      var followupBadge = '';
      if (isFollowupToday) {
        followupBadge = '<span style="background:#ffedd5;color:#c2410c;font-size:0.75rem;font-weight:700;padding:0.2rem 0.5rem;border-radius:4px;display:inline-flex;align-items:center;gap:0.25rem;">⏰ Today</span>';
      } else if (isOverdue) {
        followupBadge = '<span style="background:#fee2e2;color:#b91c1c;font-size:0.75rem;font-weight:700;padding:0.2rem 0.5rem;border-radius:4px;display:inline-flex;align-items:center;gap:0.25rem;">⚠️ Overdue: ' + esc(lead.next_followup_date) + '</span>';
      } else if (lead.next_followup_date) {
        followupBadge = '<span style="color:var(--text-muted);font-size:0.75rem;">Follow-up: ' + esc(lead.next_followup_date) + '</span>';
      }

      var photoThumb = '';
      if (lead.photo_data_uri) {
        photoThumb = '<img src="' + lead.photo_data_uri + '" alt="photo" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--border-color,#e5e7eb);flex-shrink:0;">';
      }

      var phoneDigits = String(lead.phone || '').replace(/\D/g, '');
      var waUrl = 'https://wa.me/91' + (phoneDigits.length === 10 ? phoneDigits : phoneDigits.slice(-10));

      return (
        '<div class="card lead-card" data-id="' + esc(lead.lead_id) + '" style="margin-bottom:0.75rem;padding:1rem;border-radius:10px;">' +
          '<div style="display:flex;gap:0.6rem;align-items:flex-start;">' +
            photoThumb +
            '<div style="flex:1;min-width:0;">' +
              '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.3rem;">' +
                '<h3 style="margin:0;font-size:1.05rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60vw;">' + esc(lead.name) + '</h3>' +
                '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.25rem;flex-shrink:0;">' +
                  '<span class="badge ' + statusBadgeClass + '" style="font-size:0.72rem;">' + esc(lead.status) + '</span>' +
                  followupBadge +
                '</div>' +
              '</div>' +
              '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.4rem;">' +
                'ID: <strong>' + esc(lead.lead_id) + '</strong>' +
                (lead.city ? ' · 📍 ' + esc(lead.city) : '') +
                (lead.source ? ' · ' + esc(lead.source) : '') +
              '</div>' +
              (lead.interest || lead.expected_kw || lead.estimated_amount_paise ? (
                '<div style="font-size:0.82rem;background:var(--bg-main,#f9fafb);padding:0.3rem 0.5rem;border-radius:6px;margin:0.35rem 0;">' +
                  '⚡ <strong>' + (lead.expected_kw ? (lead.expected_kw + ' kW · ') : '') + '</strong>' + esc(lead.interest || 'Solar System') +
                  (lead.estimated_amount_paise ? (' · <strong style="color:var(--brand,#0284c7);">₹' + (lead.estimated_amount_paise / 100).toLocaleString('en-IN') + '</strong>') : '') +
                '</div>'
              ) : '') +
              (lead.remark ? (
                '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.4rem;white-space:pre-line;max-height:48px;overflow:hidden;">' +
                  esc(lead.remark.slice(-120)) +
                '</div>'
              ) : '') +
              (lead.status === 'WON' && lead.converted_customer_id ? (
                '<div style="font-size:0.75rem;color:var(--color-success,#16a34a);margin-bottom:0.4rem;">' +
                  '✓ Customer: <strong>' + esc(lead.converted_customer_id) + '</strong>' +
                  (lead.converted_site_id ? (' · Site: <strong>' + esc(lead.converted_site_id) + '</strong>') : '') +
                '</div>'
              ) : '') +
              '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;padding-top:0.5rem;border-top:1px solid var(--border-color,#f0f0f0);">' +
                '<button class="btn btn-secondary lead-btn-edit" data-id="' + esc(lead.lead_id) + '" style="font-size:0.78rem;padding:0.25rem 0.65rem;min-height:32px;">✏️ Edit</button>' +
                '<button class="btn btn-secondary lead-btn-note" data-id="' + esc(lead.lead_id) + '" style="font-size:0.78rem;padding:0.25rem 0.65rem;min-height:32px;">📝 Note</button>' +
                '<a href="tel:' + esc(lead.phone) + '" class="btn btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;min-height:32px;text-decoration:none;">📞 Call</a>' +
                '<a href="' + waUrl + '" target="_blank" class="btn btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;min-height:32px;text-decoration:none;">💬 WA</a>' +
                (lead.status !== 'WON' && lead.status !== 'LOST' ? (
                  '<button class="btn btn-primary lead-btn-convert" data-id="' + esc(lead.lead_id) + '" style="font-size:0.78rem;padding:0.25rem 0.65rem;min-height:32px;">🏆 Convert</button>'
                ) : '') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Bind action buttons
    listView.querySelectorAll('.lead-btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var lead = allLeads.find(function (l) { return l.lead_id === btn.getAttribute('data-id'); });
        if (lead) openLeadSheet(lead);
      });
    });
    listView.querySelectorAll('.lead-btn-note').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openNoteSheet(btn.getAttribute('data-id'));
      });
    });
    listView.querySelectorAll('.lead-btn-convert').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var lead = allLeads.find(function (l) { return l.lead_id === btn.getAttribute('data-id'); });
        if (lead) openConvertSheet(lead);
      });
    });
  }

  // ─────────────────────────────────────────────
  // Add / Edit Lead Bottom Sheet (with optional photo)
  // ─────────────────────────────────────────────
  function openLeadSheet(existingLead) {
    var isEdit = !!existingLead;
    var sheetTitle = isEdit ? (t('leads.edit_title') || 'Edit Lead') : (t('leads.add_title') || 'Add New Lead');

    var sheetHtml =
      '<div style="padding:0.25rem 0;">' +
        '<div class="form-field">' +
          '<label>Customer / Lead Name *</label>' +
          '<input type="text" id="lead-f-name" class="input" value="' + esc(isEdit ? existingLead.name : '') + '" placeholder="e.g. Ramesh Patel">' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
          '<div class="form-field">' +
            '<label>Phone *</label>' +
            '<input type="tel" id="lead-f-phone" class="input" value="' + esc(isEdit ? existingLead.phone : '') + '" placeholder="10 digits">' +
          '</div>' +
          '<div class="form-field">' +
            '<label>Alt Phone</label>' +
            '<input type="tel" id="lead-f-alt-phone" class="input" value="' + esc(isEdit ? (existingLead.alt_phone || '') : '') + '">' +
          '</div>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Address</label>' +
          '<input type="text" id="lead-f-address" class="input" value="' + esc(isEdit ? (existingLead.address || '') : '') + '" placeholder="Full address / landmark">' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
          '<div class="form-field">' +
            '<label>City</label>' +
            '<input type="text" id="lead-f-city" class="input" value="' + esc(isEdit ? (existingLead.city || '') : '') + '" placeholder="City">' +
          '</div>' +
          '<div class="form-field">' +
            '<label>Source</label>' +
            '<select id="lead-f-source" class="input">' +
              ['WALKIN', 'CALL', 'REFERRAL', 'WEBSITE', 'SOCIAL', 'OTHER'].map(function (s) {
                return '<option value="' + s + '" ' + (isEdit && existingLead.source === s ? 'selected' : '') + '>' + s + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
          '<div class="form-field">' +
            '<label>Expected kW</label>' +
            '<input type="number" step="0.5" id="lead-f-kw" class="input" value="' + (isEdit ? (existingLead.expected_kw || '') : '') + '" placeholder="e.g. 5">' +
          '</div>' +
          '<div class="form-field">' +
            '<label>Quotation Amount (₹)</label>' +
            '<input type="number" id="lead-f-amount" class="input" value="' + (isEdit && existingLead.estimated_amount_paise ? (existingLead.estimated_amount_paise / 100) : '') + '" placeholder="e.g. 250000">' +
          '</div>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Status</label>' +
          '<select id="lead-f-status" class="input">' +
            STATUS_LIST.map(function (st) {
              return '<option value="' + st + '" ' + (isEdit && existingLead.status === st ? 'selected' : '') + '>' + STATUS_LABELS[st] + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="form-field" id="wrap-lost-reason" style="display:' + (isEdit && existingLead.status === 'LOST' ? 'block' : 'none') + ';">' +
          '<label>Lost Reason *</label>' +
          '<input type="text" id="lead-f-lost-reason" class="input" value="' + esc(isEdit ? (existingLead.lost_reason || '') : '') + '" placeholder="Price too high, competitor, etc.">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Next Follow-up Date</label>' +
          '<input type="date" id="lead-f-followup" class="input" value="' + (isEdit ? (existingLead.next_followup_date || '') : '') + '">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Interest / Requirements</label>' +
          '<textarea id="lead-f-interest" class="input" rows="2" placeholder="e.g. 5kW Hybrid with battery backup">' + esc(isEdit ? (existingLead.interest || '') : '') + '</textarea>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Remark / Notes</label>' +
          '<textarea id="lead-f-remark" class="input" rows="2" placeholder="Initial conversation details...">' + esc(isEdit ? (existingLead.remark || '') : '') + '</textarea>' +
        '</div>' +

        // ── Optional Photo Section ──────────────────────────────
        '<div class="form-field">' +
          '<label>Photo <span style="font-weight:400;color:var(--text-muted);font-size:0.78rem;">(Optional — site visit, meter, roof, etc.)</span></label>' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            // Existing photo preview
            (isEdit && existingLead.photo_data_uri
              ? '<img id="lead-photo-preview" src="' + existingLead.photo_data_uri + '" alt="photo" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border-color,#e5e7eb);">'
              : '<img id="lead-photo-preview" src="" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border-color,#e5e7eb);display:none;">') +
            '<div style="display:flex;flex-direction:column;gap:0.4rem;">' +
              '<label class="btn btn-secondary" for="lead-f-photo" style="min-height:36px;font-size:0.82rem;padding:0.3rem 0.75rem;cursor:pointer;margin:0;">📷 Choose Photo</label>' +
              '<input type="file" id="lead-f-photo" accept="image/*" capture="environment" style="display:none;">' +
              '<button type="button" id="lead-photo-clear" class="btn btn-secondary" style="min-height:30px;font-size:0.75rem;padding:0.2rem 0.5rem;' + (isEdit && existingLead.photo_data_uri ? '' : 'display:none;') + '">✕ Remove</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        // ───────────────────────────────────────────────────────

        '<div id="lead-sheet-err" class="text-danger" style="margin-bottom:0.75rem;font-size:0.85rem;display:none;"></div>' +
        '<button type="button" id="btn-save-lead" class="btn btn-primary btn-full" style="min-height:44px;">' + (isEdit ? 'Update Lead' : 'Save Lead') + '</button>' +
      '</div>';

    window.ui.openBottomSheet(sheetTitle, sheetHtml, '');

    // Status → lost-reason toggle
    var statusSel = document.getElementById('lead-f-status');
    var lostWrap = document.getElementById('wrap-lost-reason');
    if (statusSel && lostWrap) {
      statusSel.addEventListener('change', function () {
        lostWrap.style.display = statusSel.value === 'LOST' ? 'block' : 'none';
      });
    }

    // Photo preview
    var photoInput = document.getElementById('lead-f-photo');
    var photoPreview = document.getElementById('lead-photo-preview');
    var photoClearBtn = document.getElementById('lead-photo-clear');
    var _photoDataUri = (isEdit && existingLead.photo_data_uri) ? existingLead.photo_data_uri : null;

    if (photoInput && photoPreview) {
      photoInput.addEventListener('change', function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file) return;
        // Limit to 2MB
        if (file.size > 2 * 1024 * 1024) {
          window.ui.toast('Photo too large. Max 2MB.', 'error');
          photoInput.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
          _photoDataUri = ev.target.result;
          photoPreview.src = _photoDataUri;
          photoPreview.style.display = 'block';
          if (photoClearBtn) photoClearBtn.style.display = '';
        };
        reader.readAsDataURL(file);
      });
    }

    if (photoClearBtn) {
      photoClearBtn.addEventListener('click', function () {
        _photoDataUri = null;
        if (photoPreview) { photoPreview.src = ''; photoPreview.style.display = 'none'; }
        if (photoInput) photoInput.value = '';
        photoClearBtn.style.display = 'none';
      });
    }

    // Save
    var saveBtn = document.getElementById('btn-save-lead');
    var errEl = document.getElementById('lead-sheet-err');

    if (saveBtn) {
      saveBtn.addEventListener('click', async function () {
        await window.ui.withButtonLoading(saveBtn, async function () {
          errEl.style.display = 'none';
          var amountVal = parseFloat(document.getElementById('lead-f-amount').value) || 0;

          var payload = {
            name: document.getElementById('lead-f-name').value.trim(),
            phone: document.getElementById('lead-f-phone').value.trim(),
            alt_phone: document.getElementById('lead-f-alt-phone').value.trim(),
            address: document.getElementById('lead-f-address').value.trim(),
            city: document.getElementById('lead-f-city').value.trim(),
            source: document.getElementById('lead-f-source').value,
            expected_kw: parseFloat(document.getElementById('lead-f-kw').value) || 0,
            estimated_amount_paise: Math.round(amountVal * 100),
            status: document.getElementById('lead-f-status').value,
            lost_reason: document.getElementById('lead-f-lost-reason').value.trim(),
            next_followup_date: document.getElementById('lead-f-followup').value,
            interest: document.getElementById('lead-f-interest').value.trim(),
            remark: document.getElementById('lead-f-remark').value.trim()
          };

          // Attach photo only if changed/set
          if (_photoDataUri && _photoDataUri !== (isEdit && existingLead.photo_data_uri ? existingLead.photo_data_uri : null)) {
            payload.photo_data_uri = _photoDataUri;
          } else if (!_photoDataUri && isEdit && existingLead.photo_data_uri) {
            payload.photo_data_uri = ''; // cleared
          }

          if (!payload.name) { errEl.textContent = 'Please enter lead name'; errEl.style.display = 'block'; return; }
          if (!payload.phone || payload.phone.replace(/\D/g, '').length !== 10) {
            errEl.textContent = 'Please enter a valid 10-digit phone number'; errEl.style.display = 'block'; return;
          }
          if (payload.status === 'LOST' && !payload.lost_reason) {
            errEl.textContent = 'Lost reason is required when status is LOST'; errEl.style.display = 'block'; return;
          }

          try {
            if (isEdit) {
              payload.lead_id = existingLead.lead_id;
              await window.api.call('leads.update', payload);
              window.ui.toast('Lead updated successfully', 'success');
            } else {
              var createRes = await window.api.call('leads.create', payload);
              if (createRes && createRes.duplicate_phone_warning) {
                window.ui.toast('Lead saved (Note: phone already exists in system)', 'warning');
              } else {
                window.ui.toast('Lead created successfully', 'success');
              }
            }
            window.ui.closeBottomSheet();
            await loadLeads();
          } catch (e) {
            errEl.textContent = e.message || 'Operation failed';
            errEl.style.display = 'block';
          }
        });
      });
    }
  }

  // ─────────────────────────────────────────────
  // Add Note Bottom Sheet
  // ─────────────────────────────────────────────
  function openNoteSheet(leadId) {
    var lead = allLeads.find(function (l) { return l.lead_id === leadId; });
    var sheetTitle = 'Notes — ' + (lead ? lead.name : leadId);

    var sheetHtml =
      '<div style="padding:0.25rem 0;">' +
        '<div style="background:var(--bg-main,#f9fafb);padding:0.75rem;border-radius:8px;max-height:200px;overflow-y:auto;font-size:0.85rem;white-space:pre-line;margin-bottom:1rem;border:1px solid var(--border-color,#e5e7eb);">' +
          esc(lead && lead.remark ? lead.remark : 'No notes recorded yet.') +
        '</div>' +
        '<div class="form-field">' +
          '<label>Add New Note / Follow-up Update</label>' +
          '<textarea id="note-f-text" class="input" rows="3" placeholder="Called client, discussed quote, follow-up on Friday..."></textarea>' +
        '</div>' +
        '<div id="note-sheet-err" class="text-danger" style="margin-bottom:0.75rem;font-size:0.85rem;display:none;"></div>' +
        '<button type="button" id="btn-save-note" class="btn btn-primary btn-full" style="min-height:44px;">Save Note</button>' +
      '</div>';

    window.ui.openBottomSheet(sheetTitle, sheetHtml, '');

    var noteBtn = document.getElementById('btn-save-note');
    var noteErr = document.getElementById('note-sheet-err');

    if (noteBtn) {
      noteBtn.addEventListener('click', async function () {
        await window.ui.withButtonLoading(noteBtn, async function () {
          noteErr.style.display = 'none';
          var txt = (document.getElementById('note-f-text').value || '').trim();
          if (!txt) { noteErr.textContent = 'Please enter a note'; noteErr.style.display = 'block'; return; }

          var existingRemark = (lead && lead.remark) ? lead.remark : '';
          var ts = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          var newRemark = existingRemark + (existingRemark ? '\n\n' : '') + '[' + ts + '] ' + txt;

          try {
            await window.api.call('leads.update', { lead_id: leadId, remark: newRemark });
            window.ui.toast('Note saved', 'success');
            window.ui.closeBottomSheet();
            await loadLeads();
          } catch (e) {
            noteErr.textContent = e.message || 'Failed to save note';
            noteErr.style.display = 'block';
          }
        });
      });
    }
  }

  // ─────────────────────────────────────────────
  // Convert Lead to Customer + Site
  // ─────────────────────────────────────────────
  function openConvertSheet(lead) {
    var sheetTitle = 'Convert Lead — ' + lead.name;

    var sheetHtml =
      '<div style="padding:0.25rem 0;">' +
        '<div style="background:var(--bg-main,#f9fafb);padding:0.75rem;border-radius:8px;font-size:0.88rem;margin-bottom:1rem;">' +
          '<strong>' + esc(lead.name) + '</strong><br>' +
          '<span class="text-muted">Phone: ' + esc(lead.phone) + '</span><br>' +
          (lead.city ? ('<span class="text-muted">City: ' + esc(lead.city) + '</span><br>') : '') +
          (lead.expected_kw ? ('<span class="text-muted">Interest: ' + lead.expected_kw + ' kW</span><br>') : '') +
          (lead.estimated_amount_paise ? ('<span class="text-muted">Quotation: ₹' + (lead.estimated_amount_paise / 100).toLocaleString('en-IN') + '</span>') : '') +
        '</div>' +
        '<div class="form-field" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">' +
          '<input type="checkbox" id="conv-create-site" checked style="width:20px;height:20px;">' +
          '<label for="conv-create-site" style="margin:0;font-weight:600;cursor:pointer;">Also create an active Site for this customer</label>' +
        '</div>' +
        '<div id="conv-site-fields">' +
          '<div class="form-field">' +
            '<label>Site Name</label>' +
            '<input type="text" id="conv-site-name" class="input" value="' + esc(lead.name + ' Solar Site') + '">' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
            '<div class="form-field">' +
              '<label>System kW</label>' +
              '<input type="number" step="0.5" id="conv-site-kw" class="input" value="' + (lead.expected_kw || 5) + '">' +
            '</div>' +
            '<div class="form-field">' +
              '<label>Contract Value (₹)</label>' +
              '<input type="number" id="conv-contract-val" class="input" value="' + (lead.estimated_amount_paise ? (lead.estimated_amount_paise / 100) : '') + '" placeholder="e.g. 250000">' +
            '</div>' +
          '</div>' +
          '<div class="form-field">' +
            '<label>Payment Track *</label>' +
            '<select id="conv-payment-type" class="input">' +
              '<option value="CASH">CASH (16 Standard Stages)</option>' +
              '<option value="FINANCE">FINANCE / LOAN (18 Bank & Loan Stages)</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div id="conv-sheet-err" class="text-danger" style="margin-bottom:0.75rem;font-size:0.85rem;display:none;"></div>' +
        '<button type="button" id="btn-do-convert" class="btn btn-primary btn-full" style="min-height:44px;">Confirm & Convert</button>' +
      '</div>';

    window.ui.openBottomSheet(sheetTitle, sheetHtml, '');

    var chkSite = document.getElementById('conv-create-site');
    var siteFields = document.getElementById('conv-site-fields');
    if (chkSite && siteFields) {
      chkSite.addEventListener('change', function () {
        siteFields.style.display = chkSite.checked ? 'block' : 'none';
      });
    }

    var convertBtn = document.getElementById('btn-do-convert');
    var errEl = document.getElementById('conv-sheet-err');

    if (convertBtn) {
      convertBtn.addEventListener('click', async function () {
        await window.ui.withButtonLoading(convertBtn, async function () {
          var createSite = chkSite ? chkSite.checked : false;
          var contractVal = parseFloat(document.getElementById('conv-contract-val').value) || 0;

          var payload = {
            lead_id: lead.lead_id,
            create_site: createSite,
            site_name: createSite ? document.getElementById('conv-site-name').value.trim() : '',
            capacity_kw: createSite ? (parseFloat(document.getElementById('conv-site-kw').value) || 0) : 0,
            contract_value_paise: Math.round(contractVal * 100),
            payment_type: (document.getElementById('conv-payment-type') && document.getElementById('conv-payment-type').value) || 'CASH'
          };

          try {
            var res = await window.api.call('leads.convert', payload);
            window.ui.toast('Lead converted! Customer: ' + res.customer_id + (res.site_id ? (' · Site: ' + res.site_id) : ''), 'success');
            window.ui.closeBottomSheet();
            await loadLeads();
          } catch (e) {
            errEl.textContent = e.message || 'Conversion failed';
            errEl.style.display = 'block';
          }
        });
      });
    }
  }

  // Header Add Button
  var addBtn = document.getElementById('btn-add-lead');
  if (addBtn) {
    addBtn.addEventListener('click', function () { openLeadSheet(null); });
  }

  // Initial load
  await loadLeads();
};
