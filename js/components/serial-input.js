/**
 * serial-input.js — Reusable Serial Numbers Input Bottom Sheet Component.
 *
 * Supports:
 *   - Multiline paste, comma/semicolon/newline separation.
 *   - Real-time clean count vs expected quantity.
 *   - Duplicate detection (highlights duplicates in list).
 */

window.serialInput = (function() {

  function parseSerials(text) {
    if (!text) return [];
    return text
      .split(/[\r\n,;]+/)
      .map(function(s) { return s.trim(); })
      .filter(function(s) { return s.length > 0; });
  }

  function findDuplicates(list) {
    var counts = {};
    var dupes = [];
    list.forEach(function(item) {
      counts[item] = (counts[item] || 0) + 1;
      if (counts[item] === 2) dupes.push(item);
    });
    return dupes;
  }

  function open(options) {
    var title = options.title || 'Enter Serial Numbers';
    var expectedQty = options.expectedQty || 0;
    var initialSerials = options.initialSerials || [];
    var onConfirm = options.onConfirm;

    var initialText = initialSerials.join('\n');

    var html = `
      <div style="margin-bottom:0.75rem;">
        <p class="text-muted" style="margin:0 0 0.5rem 0; font-size:0.875rem;">
          Paste serials or type one per line. Target: <strong>${expectedQty}</strong>
        </p>
        <textarea id="si-textarea" class="input" rows="8" placeholder="Enter or paste serial numbers here…">${window.ui.esc(initialText)}</textarea>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; font-size:0.875rem;">
        <div>Entered: <strong id="si-count">0</strong> / <strong>${expectedQty}</strong></div>
        <div id="si-dupe-warn" class="text-error" style="display:none;">Duplicates detected!</div>
      </div>
      <div id="si-error" class="text-error" style="display:none; margin-bottom:0.75rem;"></div>
    `;

    var footerHtml = `
      <button class="btn btn-primary btn-full" id="si-confirm-btn">${window.ui.esc(window.i18n.t('btn.confirm'))}</button>
      <button class="btn btn-secondary btn-full" id="si-cancel-btn">${window.ui.esc(window.i18n.t('btn.cancel'))}</button>
    `;

    window.ui.openBottomSheet(title, html, footerHtml);

    var textarea = document.getElementById('si-textarea');
    var countEl = document.getElementById('si-count');
    var dupeWarn = document.getElementById('si-dupe-warn');
    var errorEl = document.getElementById('si-error');
    var confirmBtn = document.getElementById('si-confirm-btn');
    var cancelBtn = document.getElementById('si-cancel-btn');

    function updateCounter() {
      var list = parseSerials(textarea.value);
      countEl.textContent = list.length;
      if (expectedQty > 0 && list.length === expectedQty) {
        countEl.style.color = 'var(--success, #16a34a)';
      } else if (expectedQty > 0 && list.length > expectedQty) {
        countEl.style.color = 'var(--danger, #dc2626)';
      } else {
        countEl.style.color = 'inherit';
      }

      var dupes = findDuplicates(list);
      if (dupes.length > 0) {
        dupeWarn.textContent = 'Duplicate: ' + dupes.slice(0, 3).join(', ') + (dupes.length > 3 ? '…' : '');
        dupeWarn.style.display = 'block';
      } else {
        dupeWarn.style.display = 'none';
      }
    }

    textarea.oninput = updateCounter;
    updateCounter();

    cancelBtn.onclick = function() {
      window.ui.closeBottomSheet();
    };

    confirmBtn.onclick = function() {
      var list = parseSerials(textarea.value);
      var dupes = findDuplicates(list);
      if (dupes.length > 0) {
        errorEl.textContent = 'Please remove duplicate serials before confirming.';
        errorEl.style.display = 'block';
        return;
      }
      if (expectedQty > 0 && list.length > expectedQty) {
        errorEl.textContent = 'Serial count (' + list.length + ') cannot exceed required qty (' + expectedQty + ').';
        errorEl.style.display = 'block';
        return;
      }
      window.ui.closeBottomSheet();
      if (onConfirm) onConfirm(list);
    };
  }

  return {
    open: open,
    parseSerials: parseSerials
  };

})();
