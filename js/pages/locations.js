/**
 * locations.js — Locations standalone page (extracted from masters.js).
 * Nav tab: Locations (#/locations)
 */

window.pages = window.pages || {};

window.pages.locations = async function(container) {
  var t = window.i18n.t;
  var isOwner = window.auth.isOwnerLike(window.auth.getUser() && window.auth.getUser().role);

  container.innerHTML = `
    <div style="margin-bottom:0.75rem;">
      <h2 style="margin:0;">${window.ui.esc(t('masters.tab_locations') || 'Locations')}</h2>
    </div>
    <div id="loc-page-content">
      <div style="text-align:center; padding:2rem 0;"><span class="spinner"></span></div>
    </div>
  `;

  var target = document.getElementById('loc-page-content');
  renderLocationsSub(target);

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
      var results = await Promise.all([
        window.api.call('locations.list', { limit: 9999 }),
        window.api.call('branches.list', {})
      ]);
      locations = results[0].items || [];
      branches = results[1].items || [];
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

    if (searchEl) {
      searchEl.oninput = function() {
        renderLocationItems(locations, searchEl.value);
      };
    }

    if (addBtn) {
      addBtn.onclick = function() { openLocationForm(null); };
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
};
