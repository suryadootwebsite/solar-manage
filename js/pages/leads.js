/**
 * leads.js — Leads Pipeline & Customer Conversion Screen (S14).
 *
 * Implements:
 *   - Status filter chips with live counts.
 *   - Search bar via shared list-search component.
 *   - Today / Overdue follow-up highlights.
 *   - Direct call (tel:) & WhatsApp (wa.me) links.
 *   - Add / Edit Lead bottom sheet.
 *   - Notes timeline bottom sheet.
 *   - Convert to Customer & Site modal.
 */

window.pages = window.pages || {};

window.pages.leads = async function (container) {
  var t = (window.i18n && window.i18n.t) ? window.i18n.t : function (k) { return k; };
  var esc = (window.ui && window.ui.esc) ? window.ui.esc : function (s) { return String(s || ''); };

  var user = (window.auth && window.auth.getUser) ? window.auth.getUser() : {};
  var isOwnerOrManager = user.role === 'OWNER' || user.role === 'DEVELOPER' || user.role === 'MANAGER';

  if (!isOwnerOrManager) {
    container.innerHTML = '<div class="card text-danger" style="padding:2rem;text-align:center;">' +
      'Access denied. Leads pipeline is restricted to Owner and Manager.</div>';
    return;
  }

  container.innerHTML = 
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">' +
      '<div>' +
        '<h2 style="margin:0;font-size:1.35rem;">' + esc(t('leads.title') || 'Leads Pipeline') + '</h2>' +
        '<p class="text-muted" style="margin:0.2rem 0 0;font-size:0.85rem;">' + esc(t('leads.subtitle') || 'Inquiries, follow-ups & customer conversions') + '</p>' +
      '</div>' +
      '<button id="btn-add-lead" class="btn btn-primary" style="min-height:42px;">+ ' + esc(t('leads.new_btn') || 'Add Lead') + '</button>' +
    '</div>' +

    '<div id="leads-search-mount"></div>' +

    '<div id="leads-filter-chips" class="filter-chips-scroll" style="display:flex;gap:0.4rem;overflow-x:auto;padding-bottom:0.5rem;margin-bottom:0.75rem;-webkit-overflow-scrolling:touch;">' +
      '<button type="button" class="chip active" data-status="ALL">' + esc(t('leads.filter_all') || 'All') + ' <span class="chip-count" id="count-ALL">0</span></button>' +
      '<button type="button" class="chip" data-status="NEW">' + esc(t('leads.status_NEW') || 'New') + ' <span class="chip-count" id="count-NEW">0</span></button>' +
      '<button type="button" class="chip" data-status="CONTACTED">' + esc(t('leads.status_CONTACTED') || 'Contacted') + ' <span class="chip-count" id="count-CONTACTED">0</span></button>' +
      '<button type="button" class="chip" data-status="SITE_VISIT">' + esc(t('leads.status_SITE_VISIT') || 'Site Visit') + ' <span class="chip-count" id="count-SITE_VISIT">0</span></button>' +
      '<button type="button" class="chip" data-status="QUOTATION_SENT">' + esc(t('leads.status_QUOTATION_SENT') || 'Quote') + ' <span class="chip-count" id="count-QUOTATION_SENT">0</span></button>' +
      '<button type="button" class="chip" data-status="NEGOTIATION">' + esc(t('leads.status_NEGOTIATION') || 'Negotiation') + ' <span class="chip-count" id="count-NEGOTIATION">0</span></button>' +
      '<button type="button" class="chip" data-status="WON">' + esc(t('leads.status_WON') || 'Won') + ' <span class="chip-count" id="count-WON">0</span></button>' +
      '<button type="button" class="chip" data-status="LOST">' + esc(t('leads.status_LOST') || 'Lost') + ' <span class="chip-count" id="count-LOST">0</span></button>' +
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
      placeholder: t('leads.search_placeholder') || 'Search name, phone, city, notes...',
      onSearch: function (q) {
        searchQuery = q;
        renderLeadsList();
      }
    });
    searchMount.appendChild(searchBar.element);
  }

  // Filter chips click
  var chips = container.querySelectorAll('#leads-filter-chips .chip');
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (ch) { ch.classList.remove('active'); });
      c.classList.add('active');
      currentStatus = c.getAttribute('data-status');
      renderLeadsList();
    });
  });

  // Load Leads
  async function loadLeads() {
    try {
      var res = await window.api.call('leads.list', { limit: 100 });
      allLeads = (res && res.leads) || [];
      updateStatusCounts();
      renderLeadsList();
    } catch (err) {
      listView.innerHTML = '<div class="card text-danger" style="padding:1rem;text-align:center;">Failed to load leads: ' + esc(err.message || 'Error') + '</div>';
    }
  }

  function updateStatusCounts() {
    var counts = { ALL: allLeads.length };
    ['NEW', 'CONTACTED', 'SITE_VISIT', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST'].forEach(function (st) {
      counts[st] = 0;
    });

    allLeads.forEach(function (l) {
      if (counts[l.status] !== undefined) counts[l.status]++;
    });

    for (var st in counts) {
      var el = document.getElementById('count-' + st);
      if (el) el.textContent = counts[st];
    }
  }

  function renderLeadsList() {
    var filtered = allLeads;

    // Filter by status
    if (currentStatus !== 'ALL') {
      filtered = filtered.filter(function (l) { return l.status === currentStatus; });
    }

    // Filter by search query across multiple fields
    if (searchQuery && window.components && window.components.filterListByQuery) {
      filtered = window.components.filterListByQuery(filtered, searchQuery, ['name', 'phone', 'alt_phone', 'city', 'interest', 'remark', 'lead_id']);
    }

    if (!filtered.length) {
      listView.innerHTML = '<div class="card text-muted" style="text-align:center;padding:2rem;">' + esc(t('leads.empty') || 'No leads found') + '</div>';
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

      var phoneDigits = String(lead.phone || '').replace(/\D/g, '');
      var waUrl = 'https://wa.me/91' + (phoneDigits.length === 10 ? phoneDigits : phoneDigits.slice(-10));

      return (
        '<div class="card lead-card" data-id="' + esc(lead.lead_id) + '" style="margin-bottom:0.75rem;padding:1rem;border-radius:10px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.4rem;">' +
            '<div>' +
              '<h3 style="margin:0;font-size:1.05rem;font-weight:700;">' + esc(lead.name) + '</h3>' +
              '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.2rem;">' +
                'ID: <strong>' + esc(lead.lead_id) + '</strong>' +
                (lead.city ? ' · 📍 ' + esc(lead.city) : '') +
                (lead.source ? ' · ' + esc(t('leads.source_' + lead.source) || lead.source) : '') +
              '</div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.3rem;">' +
              '<span class="badge ' + statusBadgeClass + '" style="font-size:0.75rem;">' + esc(t('leads.status_' + lead.status) || lead.status) + '</span>' +
              followupBadge +
            '</div>' +
          '</div>' +

          (lead.interest || lead.expected_kw ? (
            '<div style="font-size:0.85rem;background:var(--bg-main, #f9fafb);padding:0.4rem 0.6rem;border-radius:6px;margin:0.5rem 0;">' +
              '⚡ <strong>' + (lead.expected_kw ? (lead.expected_kw + ' kW · ') : '') + '</strong>' + esc(lead.interest || 'Solar System') +
            '</div>'
          ) : '') +

          (lead.remark ? (
            '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.6rem;white-space:pre-line;max-height:60px;overflow:hidden;">' +
              esc(lead.remark.slice(-150)) +
            '</div>'
          ) : '') +

          (lead.status === 'WON' && lead.converted_customer_id ? (
            '<div style="font-size:0.78rem;color:var(--color-success, #16a34a);margin-bottom:0.5rem;">' +
              '✓ Converted to Customer: <strong>' + esc(lead.converted_customer_id) + '</strong>' +
              (lead.converted_site_id ? (' · Site: <strong>' + esc(lead.converted_site_id) + '</strong>') : '') +
            '</div>'
          ) : '') +

          // Action Buttons
          '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid var(--border-color, #f3f4f6);">' +
            '<a href="tel:' + esc(lead.phone) + '" class="btn btn-outline btn-sm" style="flex:1;min-height:36px;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-size:0.8rem;">' +
              '📞 Call' +
            '</a>' +
            '<a href="' + waUrl + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="flex:1;min-height:36px;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-size:0.8rem;color:#16a34a;border-color:#16a34a;">' +
              '💬 WhatsApp' +
            '</a>' +
            '<button type="button" class="btn btn-outline btn-sm btn-lead-note" data-id="' + esc(lead.lead_id) + '" style="min-height:36px;font-size:0.8rem;">📝 Note</button>' +
            '<button type="button" class="btn btn-secondary btn-sm btn-lead-edit" data-id="' + esc(lead.lead_id) + '" style="min-height:36px;font-size:0.8rem;">Edit</button>' +
            (lead.status !== 'WON' ? (
              '<button type="button" class="btn btn-primary btn-sm btn-lead-convert" data-id="' + esc(lead.lead_id) + '" style="min-height:36px;font-size:0.8rem;">Convert ➔</button>'
            ) : '') +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Attach card action listeners
    attachCardListeners();
  }

  function attachCardListeners() {
    // Add Note
    listView.querySelectorAll('.btn-lead-note').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var leadId = btn.getAttribute('data-id');
        openNoteSheet(leadId);
      });
    });

    // Edit
    listView.querySelectorAll('.btn-lead-edit').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var leadId = btn.getAttribute('data-id');
        var lead = allLeads.find(function (l) { return l.lead_id === leadId; });
        if (lead) openLeadSheet(lead);
      });
    });

    // Convert
    listView.querySelectorAll('.btn-lead-convert').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var leadId = btn.getAttribute('data-id');
        var lead = allLeads.find(function (l) { return l.lead_id === leadId; });
        if (lead) openConvertSheet(lead);
      });
    });
  }

  // Add / Edit Lead Bottom Sheet
  function openLeadSheet(existingLead) {
    var isEdit = !!existingLead;
    var sheetHtml = 
      '<div style="padding:1rem;">' +
        '<h3 style="margin:0 0 1rem;font-size:1.15rem;">' + (isEdit ? 'Edit Lead' : 'Add New Lead') + '</h3>' +
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
            '<input type="tel" id="lead-f-alt-phone" class="input" value="' + esc(isEdit ? existingLead.alt_phone : '') + '">' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
          '<div class="form-field">' +
            '<label>City</label>' +
            '<input type="text" id="lead-f-city" class="input" value="' + esc(isEdit ? existingLead.city : '') + '" placeholder="City">' +
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
            '<label>Status</label>' +
            '<select id="lead-f-status" class="input">' +
              ['NEW', 'CONTACTED', 'SITE_VISIT', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST'].map(function (st) {
                return '<option value="' + st + '" ' + (isEdit && existingLead.status === st ? 'selected' : '') + '>' + st + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="form-field" id="wrap-lost-reason" style="display:' + (isEdit && existingLead.status === 'LOST' ? 'block' : 'none') + ';">' +
          '<label>Lost Reason *</label>' +
          '<input type="text" id="lead-f-lost-reason" class="input" value="' + esc(isEdit ? existingLead.lost_reason : '') + '" placeholder="Price too high, competitor, etc.">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Next Follow-up Date</label>' +
          '<input type="date" id="lead-f-followup" class="input" value="' + (isEdit ? (existingLead.next_followup_date || '') : '') + '">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Interest / Requirements</label>' +
          '<textarea id="lead-f-interest" class="input" rows="2" placeholder="e.g. 5kW Hybrid with battery backup">' + esc(isEdit ? existingLead.interest : '') + '</textarea>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Remark / Notes</label>' +
          '<textarea id="lead-f-remark" class="input" rows="2" placeholder="Initial conversation details...">' + esc(isEdit ? existingLead.remark : '') + '</textarea>' +
        '</div>' +
        '<div id="lead-sheet-err" class="text-danger" style="margin-bottom:0.75rem;font-size:0.85rem;display:none;"></div>' +
        '<button type="button" id="btn-save-lead" class="btn btn-primary btn-full" style="min-height:44px;">' + (isEdit ? 'Update Lead' : 'Save Lead') + '</button>' +
      '</div>';

    window.ui.openBottomSheet(sheetHtml);

    var statusSel = document.getElementById('lead-f-status');
    var lostWrap = document.getElementById('wrap-lost-reason');
    if (statusSel && lostWrap) {
      statusSel.addEventListener('change', function () {
        lostWrap.style.display = statusSel.value === 'LOST' ? 'block' : 'none';
      });
    }

    var saveBtn = document.getElementById('btn-save-lead');
    var errEl = document.getElementById('lead-sheet-err');

    if (saveBtn) {
      saveBtn.addEventListener('click', async function () {
        await window.ui.withButtonLoading(saveBtn, async function () {
          errEl.style.display = 'none';
          var payload = {
            name: document.getElementById('lead-f-name').value.trim(),
            phone: document.getElementById('lead-f-phone').value.trim(),
            alt_phone: document.getElementById('lead-f-alt-phone').value.trim(),
            city: document.getElementById('lead-f-city').value.trim(),
            source: document.getElementById('lead-f-source').value,
            expected_kw: parseFloat(document.getElementById('lead-f-kw').value) || 0,
            status: document.getElementById('lead-f-status').value,
            lost_reason: document.getElementById('lead-f-lost-reason').value.trim(),
            next_followup_date: document.getElementById('lead-f-followup').value,
            interest: document.getElementById('lead-f-interest').value.trim(),
            remark: document.getElementById('lead-f-remark').value.trim()
          };

          if (!payload.name) {
            errEl.textContent = 'Please enter lead name';
            errEl.style.display = 'block';
            return;
          }
          if (!payload.phone || payload.phone.replace(/\D/g, '').length !== 10) {
            errEl.textContent = 'Please enter a valid 10-digit phone number';
            errEl.style.display = 'block';
            return;
          }
          if (payload.status === 'LOST' && !payload.lost_reason) {
            errEl.textContent = 'Lost reason is required when status is LOST';
            errEl.style.display = 'block';
            return;
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

  // Add Note Bottom Sheet
  function openNoteSheet(leadId) {
    var lead = allLeads.find(function (l) { return l.lead_id === leadId; });
    var sheetHtml = 
      '<div style="padding:1rem;">' +
        '<h3 style="margin:0 0 0.5rem;font-size:1.15rem;">Notes Timeline — ' + esc(lead ? lead.name : leadId) + '</h3>' +
        '<div style="background:var(--bg-main, #f9fafb);padding:0.75rem;border-radius:8px;max-height:200px;overflow-y:auto;font-size:0.85rem;white-space:pre-line;margin-bottom:1rem;border:1px solid var(--border-color, #e5e7eb);">' +
          esc(lead && lead.remark ? lead.remark : 'No notes recorded yet.') +
        '</div>' +
        '<div class="form-field">' +
          '<label>Add New Note / Follow-up Update</label>' +
          '<textarea id="note-f-text" class="input" rows="3" placeholder="Called client, discussed 5kW quote, follow-up on Friday..."></textarea>' +
        '</div>' +
        '<div id="note-sheet-err" class="text-danger" style="margin-bottom:0.75rem;font-size:0.85rem;display:none;"></div>' +
        '<button type="button" id="btn-save-note" class="btn btn-primary btn-full" style="min-height:44px;">Add Note to Timeline</button>' +
      '</div>';

    window.ui.openBottomSheet(sheetHtml);

    var saveBtn = document.getElementById('btn-save-note');
    var errEl = document.getElementById('note-sheet-err');
    var noteInput = document.getElementById('note-f-text');

    if (saveBtn) {
      saveBtn.addEventListener('click', async function () {
        var note = noteInput.value.trim();
        if (!note) {
          errEl.textContent = 'Please enter note text';
          errEl.style.display = 'block';
          return;
        }

        await window.ui.withButtonLoading(saveBtn, async function () {
          try {
            await window.api.call('leads.addNote', { lead_id: leadId, note: note });
            window.ui.toast('Note added to timeline', 'success');
            window.ui.closeBottomSheet();
            await loadLeads();
          } catch (e) {
            errEl.textContent = e.message || 'Failed to add note';
            errEl.style.display = 'block';
          }
        });
      });
    }
  }

  // Convert to Customer & Site Sheet
  function openConvertSheet(lead) {
    var sheetHtml = 
      '<div style="padding:1rem;">' +
        '<h3 style="margin:0 0 0.5rem;font-size:1.15rem;">Convert Lead to Customer</h3>' +
        '<p class="text-muted" style="margin:0 0 1rem;font-size:0.85rem;">This will create a permanent Customer master record and optionally a new active Site.</p>' +
        '<div class="card" style="margin-bottom:1rem;padding:0.75rem;font-size:0.85rem;">' +
          '<strong>Customer:</strong> ' + esc(lead.name) + '<br>' +
          '<strong>Phone:</strong> ' + esc(lead.phone) + '<br>' +
          (lead.city ? ('<strong>City:</strong> ' + esc(lead.city) + '<br>') : '') +
          (lead.expected_kw ? ('<strong>Interest:</strong> ' + lead.expected_kw + ' kW') : '') +
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
              '<input type="number" id="conv-contract-val" class="input" placeholder="e.g. 250000">' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="conv-sheet-err" class="text-danger" style="margin-bottom:0.75rem;font-size:0.85rem;display:none;"></div>' +
        '<button type="button" id="btn-do-convert" class="btn btn-primary btn-full" style="min-height:44px;">Confirm & Convert</button>' +
      '</div>';

    window.ui.openBottomSheet(sheetHtml);

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
            contract_value_paise: Math.round(contractVal * 100)
          };

          try {
            var res = await window.api.call('leads.convert', payload);
            window.ui.toast('Lead converted successfully! Customer: ' + res.customer_id + (res.site_id ? (' · Site: ' + res.site_id) : ''), 'success');
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
    addBtn.addEventListener('click', function () {
      openLeadSheet(null);
    });
  }

  // Initial load
  await loadLeads();
};
