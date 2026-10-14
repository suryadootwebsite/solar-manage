/**
 * ui.js — UI Helpers: Toasts, Modals, Bottom Sheets, Loading Spinners, HTML Escaping.
 *
 * Enforces:
 *   - Button double-tap prevention & loading states (Doc 03 F-30).
 *   - Bottom sheet component for mobile convenience (Doc 06 §1).
 *   - Non-blocking toast notifications.
 *   - Safe HTML escaping (esc) to prevent XSS during data rendering.
 */

window.ui = (function() {

  /**
   * HTML escape helper to prevent XSS when interpolating dynamic data into innerHTML.
   * @param {*} str
   * @returns {string}
   */
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message, type, durationMs) {
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, durationMs || 3500);
  }

  function showSpinner() {
    var overlay = document.getElementById('global-spinner-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  function hideSpinner() {
    var overlay = document.getElementById('global-spinner-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  var _sheetStack = [];

  function openBottomSheet(title, bodyHtml, footerButtonsHtml) {
    var backdrop = document.getElementById('modal-backdrop');
    if (!backdrop) return;

    var layer = document.createElement('div');
    layer.className = 'bottom-sheet bottom-sheet-layer';
    var layerIndex = _sheetStack.length;
    layer.style.zIndex = String(510 + layerIndex * 10);

    var footerMarkup = footerButtonsHtml ? `
      <div class="sheet-footer">
        ${footerButtonsHtml}
      </div>
    ` : '';

    layer.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <h3 style="margin:0; font-size:1.15rem; color:var(--text-main);">${esc(title)}</h3>
        <button type="button" class="btn btn-secondary sheet-close-btn" style="font-size:1.4rem; line-height:1; min-height:40px; min-width:40px; padding:0; border-radius:50%; border:none;" aria-label="Close">&times;</button>
      </div>
      <div class="sheet-body">
        ${bodyHtml}
      </div>
      ${footerMarkup}
    `;

    backdrop.appendChild(layer);
    _sheetStack.push(layer);

    // Apply scroll lock to body
    document.body.classList.add('sheet-open');
    backdrop.classList.add('is-open');

    // Force reflow for entrance animation
    void layer.offsetHeight;
    layer.classList.add('layer-active');

    var closeBtn = layer.querySelector('.sheet-close-btn');
    if (closeBtn) {
      closeBtn.onclick = function() {
        closeBottomSheet();
      };
    }

    backdrop.onclick = function(e) {
      if (e.target === backdrop) {
        closeBottomSheet();
      }
    };
  }

  function closeBottomSheet() {
    if (_sheetStack.length === 0) return;
    var topLayer = _sheetStack.pop();

    if (topLayer && topLayer.parentNode) {
      topLayer.classList.remove('layer-active');
      setTimeout(function() {
        if (topLayer.parentNode) topLayer.parentNode.removeChild(topLayer);
      }, 200);
    }

    if (_sheetStack.length === 0) {
      var backdrop = document.getElementById('modal-backdrop');
      if (backdrop) backdrop.classList.remove('is-open');
      document.body.classList.remove('sheet-open');
    }
  }

  function closeAllBottomSheets() {
    while (_sheetStack.length > 0) {
      var layer = _sheetStack.pop();
      if (layer && layer.parentNode) {
        layer.parentNode.removeChild(layer);
      }
    }
    var backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
  }

  // Handle hardware / browser back button to close top bottom sheet first
  window.addEventListener('popstate', function() {
    if (_sheetStack.length > 0) {
      closeBottomSheet();
    }
  });

  function confirmDialog(title, message, onConfirm, onCancel) {
    var confirmText = window.i18n.t('btn.confirm') || 'Confirm';
    var cancelText = window.i18n.t('btn.cancel') || 'Cancel';

    openBottomSheet(
      title,
      `<p style="font-size:1rem; color:var(--text-main);">${esc(message)}</p>`,
      `
        <button id="modal-confirm-btn" class="btn btn-danger btn-block">${confirmText}</button>
        <button id="modal-cancel-btn" class="btn btn-secondary btn-block">${cancelText}</button>
      `
    );

    var topLayer = _sheetStack[_sheetStack.length - 1];
    if (topLayer) {
      var cBtn = topLayer.querySelector('#modal-confirm-btn');
      var xBtn = topLayer.querySelector('#modal-cancel-btn');
      if (cBtn) {
        cBtn.onclick = function() {
          closeBottomSheet();
          if (typeof onConfirm === 'function') onConfirm();
        };
      }
      if (xBtn) {
        xBtn.onclick = function() {
          closeBottomSheet();
          if (typeof onCancel === 'function') onCancel();
        };
      }
    }
  }

  /**
   * Disables button during asynchronous action to prevent double-submissions and show spinner feedback.
   */
  async function withButtonLoading(button, asyncFn) {
    if (typeof button === 'string') {
      button = document.querySelector(button);
    }
    if (!button) {
      if (typeof asyncFn === 'function') return await asyncFn();
      return;
    }
    if (button.disabled) return;

    var originalHtml = button.innerHTML;
    button.disabled = true;
    button.classList.add('btn-loading');
    button.innerHTML = '<span class="spinner" style="margin-right:0.5rem; display:inline-block; vertical-align:middle; width:14px; height:14px;"></span> ' + originalHtml;

    try {
      return await asyncFn();
    } finally {
      button.disabled = false;
      button.classList.remove('btn-loading');
      button.innerHTML = originalHtml;
    }
  }

  // Shared event delegation for buttons marked [data-async]
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('button[data-async]');
    if (!btn || btn.disabled) return;
    var orig = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    btn.innerHTML = '<span class="spinner" style="margin-right:0.5rem; display:inline-block; vertical-align:middle; width:14px; height:14px;"></span> ' + orig;
    setTimeout(function() {
      if (btn.disabled) {
        btn.disabled = false;
        btn.classList.remove('btn-loading');
        btn.innerHTML = orig;
      }
    }, 10000);
  });

  return {
    esc: esc,
    toast: showToast,
    showToast: showToast,
    showSpinner: showSpinner,
    hideSpinner: hideSpinner,
    openBottomSheet: openBottomSheet,
    closeBottomSheet: closeBottomSheet,
    closeAllBottomSheets: closeAllBottomSheets,
    getSheetStackCount: function() { return _sheetStack.length; },
    showBottomSheet: function(html) { openBottomSheet('', html, ''); },
    hideBottomSheet: closeBottomSheet,
    showConfirm: function(msg, onOk) { confirmDialog('Confirm', msg, onOk); },
    confirmDialog: confirmDialog,
    withButtonLoading: withButtonLoading
  };

})();
