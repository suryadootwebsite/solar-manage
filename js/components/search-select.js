/**
 * search-select.js — Mobile-first Searchable Select Bottom Sheet.
 *
 * Allows picking from large master lists (Products, Suppliers, Customers, Locations)
 * with instant debounced search.
 */

window.searchSelect = (function() {
  function open(options) {
    var title = options.title || 'Select Item';
    var items = options.items || [];
    var onSelect = options.onSelect;
    var getLabel = options.getLabel || function(item) { return item.name || String(item); };
    var getSub = options.getSub || function(item) { return ''; };
    var placeholder = options.placeholder || 'Search…';

    var html = `
      <div style="margin-bottom:0.75rem;">
        <input type="text" id="ss-search-input" class="input" placeholder="${window.ui.esc(placeholder)}" autofocus>
      </div>
      <div id="ss-list-container" style="max-height: 50vh; overflow-y: auto;">
      </div>
    `;

    window.ui.openBottomSheet(title, html, `
      <button class="btn btn-secondary btn-full" id="ss-cancel-btn">${window.ui.esc(window.i18n.t('btn.cancel'))}</button>
    `);

    var input = document.getElementById('ss-search-input');
    var listContainer = document.getElementById('ss-list-container');
    var cancelBtn = document.getElementById('ss-cancel-btn');

    if (cancelBtn) {
      cancelBtn.onclick = function() {
        window.ui.closeBottomSheet();
      };
    }

    function renderList(query) {
      var q = (query || '').toLowerCase().trim();
      var filtered = items.filter(function(item) {
        if (!q) return true;
        var l = getLabel(item).toLowerCase();
        var s = getSub(item).toLowerCase();
        return l.indexOf(q) >= 0 || s.indexOf(q) >= 0;
      });

      if (!filtered.length) {
        listContainer.innerHTML = '<p class="text-muted" style="text-align:center; padding:1.5rem 0;">No items found</p>';
        return;
      }

      var itemsHtml = filtered.map(function(item, idx) {
        var label = getLabel(item);
        var sub = getSub(item);
        return `
          <div class="ss-item-row" data-idx="${idx}" style="padding:0.75rem 0.5rem; border-bottom:1px solid var(--border); cursor:pointer; min-height:44px; display:flex; flex-direction:column; justify-content:center;">
            <div style="font-weight:600; color:var(--text-main);">${window.ui.esc(label)}</div>
            ${sub ? `<div style="font-size:0.8rem; color:var(--text-muted);">${window.ui.esc(sub)}</div>` : ''}
          </div>
        `;
      }).join('');

      listContainer.innerHTML = itemsHtml;

      var rows = listContainer.querySelectorAll('.ss-item-row');
      rows.forEach(function(row) {
        row.onclick = function() {
          var idx = parseInt(row.getAttribute('data-idx'), 10);
          var selected = filtered[idx];
          window.ui.closeBottomSheet();
          if (onSelect) onSelect(selected);
        };
      });
    }

    renderList('');

    input.oninput = function() {
      renderList(input.value);
    };
  }

  return { open: open };
})();
