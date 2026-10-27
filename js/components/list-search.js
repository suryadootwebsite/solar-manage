/**
 * list-search.js — Reusable List Search Bar Component.
 *
 * Implements:
 *   - Debounce 250ms.
 *   - Clear button (✕).
 *   - Sticky at top of list.
 *   - Case-insensitive search across name, phone, id, city, serial/lot no, status.
 *   - Works together with filter chips and handles full cached list on paginated views.
 *   - EN & HI placeholder support.
 *   - Responsive at 360px with no horizontal overflow.
 */

window.components = window.components || {};

window.components.createSearchBar = function (options) {
  options = options || {};
  var t = (window.i18n && window.i18n.t) ? window.i18n.t : function (k) { return k; };
  var placeholder = options.placeholder || t('common.search_placeholder') || 'Search / खोजें...';
  var onSearch = options.onSearch || function () {};
  var initialValue = options.initialValue || '';
  var searchId = options.id || ('search-input-' + Math.random().toString(36).slice(2, 7));

  var wrapper = document.createElement('div');
  wrapper.className = 'list-search-container';
  wrapper.style.cssText = 'position:sticky;top:0;z-index:15;background:var(--bg-main, #ffffff);padding:0.5rem 0;margin-bottom:0.75rem;width:100%;box-sizing:border-box;';

  wrapper.innerHTML = 
    '<div style="position:relative;display:flex;align-items:center;width:100%;box-sizing:border-box;">' +
      '<span style="position:absolute;left:0.75rem;color:var(--text-muted);pointer-events:none;font-size:0.95rem;">🔍</span>' +
      '<input type="text" id="' + searchId + '" class="input list-search-input" value="' + (initialValue || '') + '" ' +
        'placeholder="' + window.ui.esc(placeholder) + '" ' +
        'style="width:100%;padding-left:2.25rem;padding-right:2.25rem;min-height:42px;box-sizing:border-box;font-size:0.875rem;border-radius:8px;">' +
      '<button type="button" class="list-search-clear-btn" aria-label="Clear search" style="position:absolute;right:0.6rem;background:none;border:none;' +
        'color:var(--text-muted);font-size:1.1rem;cursor:pointer;display:' + (initialValue ? 'block' : 'none') + ';padding:0.25rem 0.5rem;line-height:1;">✕</button>' +
    '</div>';

  var input = wrapper.querySelector('.list-search-input');
  var clearBtn = wrapper.querySelector('.list-search-clear-btn');
  var debounceTimer = null;

  function emitSearch(val) {
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    onSearch(val.trim().toLowerCase());
  }

  input.addEventListener('input', function () {
    var val = input.value;
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      emitSearch(input.value);
    }, 250);
  });

  clearBtn.addEventListener('click', function () {
    input.value = '';
    clearBtn.style.display = 'none';
    input.focus();
    if (debounceTimer) clearTimeout(debounceTimer);
    emitSearch('');
  });

  return {
    element: wrapper,
    input: input,
    getValue: function () { return input.value.trim().toLowerCase(); },
    setValue: function (val) {
      input.value = val;
      emitSearch(val);
    }
  };
};

/**
 * Multi-field matching helper for list searching.
 */
window.components.filterListByQuery = function (items, query, fields) {
  if (!query) return items;
  var q = String(query).toLowerCase().trim();
  if (!q) return items;
  fields = fields || ['name', 'phone', 'alt_phone', 'customer_id', 'supplier_id', 'site_id', 'lot_id', 'invoice_no', 'serial_no', 'product_id', 'city', 'status', 'stage_id', 'lead_id'];

  return (items || []).filter(function (item) {
    if (!item) return false;
    for (var i = 0; i < fields.length; i++) {
      var val = item[fields[i]];
      if (val !== undefined && val !== null && String(val).toLowerCase().indexOf(q) !== -1) {
        return true;
      }
    }
    return false;
  });
};
