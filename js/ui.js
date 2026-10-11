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

  function openBottomSheet(title, bodyHtml, footerButtonsHtml) {
    var backdrop = document.getElementById('modal-backdrop');
    var sheet = document.getElementById('bottom-sheet-content');
    if (!backdrop || !sheet) return;

    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 style="margin:0;">${esc(title)}</h3>
        <button id="sheet-close-btn" style="font-size:1.5rem; line-height:1; min-height:44px; min-width:44px;">&times;</button>
      </div>
      <div class="sheet-body" style="margin-bottom:1.5rem;">
        ${bodyHtml}
      </div>
      <div class="sheet-footer" style="display:flex; gap:0.5rem; flex-direction:column;">
        ${footerButtonsHtml || ''}
      </div>
    `;

    backdrop.classList.add('is-open');

    var closeBtn = document.getElementById('sheet-close-btn');
    if (closeBtn) closeBtn.onclick = closeBottomSheet;

    backdrop.onclick = function(e) {
      if (e.target === backdrop) closeBottomSheet();
    };
  }

  function closeBottomSheet() {
    var backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.classList.remove('is-open');
  }

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

    document.getElementById('modal-confirm-btn').onclick = function() {
      closeBottomSheet();
      if (typeof onConfirm === 'function') onConfirm();
    };

    document.getElementById('modal-cancel-btn').onclick = function() {
      closeBottomSheet();
      if (typeof onCancel === 'function') onCancel();
    };
  }

  /**
   * Disables button during asynchronous action to prevent double-submissions.
   */
  async function withButtonLoading(button, asyncFn) {
    if (!button || button.disabled) return;
    var originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner" style="margin-right:0.5rem;"></span> ' + originalHtml;

    try {
      return await asyncFn();
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  }

  return {
    esc: esc,
    toast: showToast,
    showToast: showToast,
    showSpinner: showSpinner,
    hideSpinner: hideSpinner,
    openBottomSheet: openBottomSheet,
    closeBottomSheet: closeBottomSheet,
    confirmDialog: confirmDialog,
    withButtonLoading: withButtonLoading
  };

})();
