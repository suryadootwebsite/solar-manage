/**
 * doc-manager.js — Shared Documents Component for Suppliers, Customers, and Sites (S14).
 *
 * Implements:
 *   - Client compression for images (1600px q0.85 + 320px q0.7 thumb) and raw PDF handling.
 *   - Document grid rendering with PDF icons and image thumbnails.
 *   - Full document view modal (image viewer or PDF download/open).
 *   - 2-step delete dialog requiring user to type DELETE.
 *   - Reusable across Customer detail, Supplier detail, and Site detail.
 */

window.components = window.components || {};

/**
 * Shared file compress helper (Images max 1600px q0.85 + 320px q0.7 thumb; PDF passed raw).
 */
window.components.compressFileOrDoc = async function (file) {
  if (!file) throw new Error('No file provided');

  // Handle PDF
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var base64 = reader.result.split(',')[1];
        resolve({
          fullBase64: base64,
          thumbBase64: null,
          mimeType: 'application/pdf',
          fileName: file.name,
          sizeKb: Math.round(file.size / 1024)
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Handle Images (JPEG, PNG, WebP)
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        try {
          // 1. Full Image: max 1600px, JPEG q=0.85
          var MAX_FULL = 1600;
          var w = img.width, h = img.height;
          if (w > MAX_FULL || h > MAX_FULL) {
            if (w > h) { h = Math.round((h * MAX_FULL) / w); w = MAX_FULL; }
            else { w = Math.round((w * MAX_FULL) / h); h = MAX_FULL; }
          }
          var cFull = document.createElement('canvas');
          cFull.width = w; cFull.height = h;
          var ctxF = cFull.getContext('2d');
          ctxF.drawImage(img, 0, 0, w, h);
          var fullDataUri = cFull.toDataURL('image/jpeg', 0.85);
          var fullB64 = fullDataUri.split(',')[1];

          // 2. Thumb: max 320px, JPEG q=0.7
          var MAX_THUMB = 320;
          var tw = img.width, th = img.height;
          if (tw > MAX_THUMB || th > MAX_THUMB) {
            if (tw > th) { th = Math.round((th * MAX_THUMB) / tw); tw = MAX_THUMB; }
            else { tw = Math.round((tw * MAX_THUMB) / th); th = MAX_THUMB; }
          }
          var cThumb = document.createElement('canvas');
          cThumb.width = tw; cThumb.height = th;
          var ctxT = cThumb.getContext('2d');
          ctxT.drawImage(img, 0, 0, tw, th);
          var thumbDataUri = cThumb.toDataURL('image/jpeg', 0.70);
          var thumbB64 = thumbDataUri.split(',')[1];

          resolve({
            fullBase64: fullB64,
            thumbBase64: thumbB64,
            mimeType: 'image/jpeg',
            fileName: file.name,
            sizeKb: Math.round(fullB64.length * 0.75 / 1024)
          });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Renders the Documents Section into a container element.
 */
window.components.renderDocumentsSection = async function (mountEl, entityType, entityId, entityName) {
  var t = (window.i18n && window.i18n.t) ? window.i18n.t : function (k) { return k; };
  var esc = (window.ui && window.ui.esc) ? window.ui.esc : function (s) { return String(s || ''); };

  mountEl.innerHTML = 
    '<div class="card" style="margin-top:1rem;padding:1rem;border-radius:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">' +
        '<div>' +
          '<h3 style="margin:0;font-size:1.05rem;">📄 ' + esc(t('documents.title') || 'Documents') + ' <span id="doc-count-badge" class="badge badge-primary">0</span></h3>' +
          '<span style="font-size:0.78rem;color:var(--text-muted);">Aadhaar, GST, Invoices, Agreements & Records</span>' +
        '</div>' +
        '<button type="button" id="btn-upload-doc" class="btn btn-primary btn-sm">+ ' + esc(t('documents.upload_btn') || 'Upload Document') + '</button>' +
      '</div>' +
      '<div id="doc-grid-view"><span class="spinner"></span></div>' +
    '</div>';

  var gridView = mountEl.querySelector('#doc-grid-view');
  var countBadge = mountEl.querySelector('#doc-count-badge');
  var uploadBtn = mountEl.querySelector('#btn-upload-doc');

  async function loadDocs() {
    try {
      var res = await window.api.call('documents.list', { entity_type: entityType, entity_id: entityId });
      var docs = (res && res.documents) || [];
      if (countBadge) countBadge.textContent = docs.length;

      if (!docs.length) {
        gridView.innerHTML = '<div style="text-align:center;padding:1.5rem 0;color:var(--text-muted);font-size:0.875rem;">' +
          'No documents uploaded yet. Tap "+ Upload Document" above.</div>';
        return;
      }

      gridView.innerHTML = 
        '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:0.75rem;">' +
          docs.map(function (doc) {
            var isPdf = doc.mime_type === 'application/pdf';
            var thumbId = 'doc-thumb-' + doc.doc_id;

            return (
              '<div class="doc-card" data-doc-id="' + esc(doc.doc_id) + '" style="border:1px solid var(--border-color, #e5e7eb);border-radius:8px;overflow:hidden;background:#fff;display:flex;flex-direction:column;">' +
                '<div style="position:relative;width:100%;aspect-ratio:4/3;background:#f3f4f6;cursor:pointer;display:flex;align-items:center;justify-content:center;" class="doc-view-trigger" data-doc-id="' + esc(doc.doc_id) + '">' +
                  (isPdf ? (
                    '<div style="text-align:center;padding:0.5rem;"><div style="font-size:2rem;">📄</div><span style="font-size:0.7rem;font-weight:700;color:#dc2626;">PDF</span></div>'
                  ) : (
                    '<div id="skel-' + esc(doc.doc_id) + '" style="position:absolute;inset:0;background:linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);background-size:200% 100%;animation:skeleton-shimmer 1.5s infinite;display:flex;align-items:center;justify-content:center;">' +
                      '<span style="font-size:1.5rem;opacity:0.4;">📷</span>' +
                    '</div>' +
                    '<img id="img-' + esc(doc.doc_id) + '" src="" alt="' + esc(doc.caption) + '" style="width:100%;height:100%;object-fit:cover;display:none;">'
                  )) +
                '</div>' +
                '<div style="padding:0.4rem;font-size:0.75rem;flex:1;display:flex;flex-direction:column;justify-content:space-between;">' +
                  '<div>' +
                    '<span class="badge" style="background:#e0f2fe;color:#0369a1;font-size:0.65rem;font-weight:700;margin-bottom:0.2rem;display:inline-block;">' + esc(doc.doc_type || 'Doc') + '</span>' +
                    '<div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + esc(doc.caption || doc.file_name) + '">' + esc(doc.caption || doc.file_name) + '</div>' +
                    '<div style="color:var(--text-muted);font-size:0.7rem;">' + (doc.size_kb ? doc.size_kb + ' KB' : '') + '</div>' +
                  '</div>' +
                  '<div style="margin-top:0.3rem;display:flex;justify-content:space-between;align-items:center;">' +
                    '<button type="button" class="btn btn-outline btn-sm btn-doc-view" data-doc-id="' + esc(doc.doc_id) + '" style="font-size:0.7rem;padding:0.1rem 0.35rem;min-height:26px;">View</button>' +
                    '<button type="button" class="btn btn-outline btn-sm btn-doc-del" data-doc-id="' + esc(doc.doc_id) + '" style="font-size:0.7rem;padding:0.1rem 0.35rem;min-height:26px;color:#dc2626;border-color:#dc2626;">🗑️</button>' +
                  '</div>' +
                '</div>' +
              '</div>'
            );
          }).join('') +
        '</div>';

      // Load image thumbs lazily
      docs.forEach(function (doc) {
        if (doc.mime_type !== 'application/pdf') {
          var imgEl = gridView.querySelector('#img-' + doc.doc_id);
          var skelEl = gridView.querySelector('#skel-' + doc.doc_id);
          window.api.call('documents.image', { doc_id: doc.doc_id, size: 'thumb' })
            .then(function (res) {
              if (res && res.data_uri && imgEl) {
                imgEl.src = res.data_uri;
                imgEl.style.display = 'block';
                if (skelEl) skelEl.style.display = 'none';
              }
            })
            .catch(function () {});
        }
      });

      // View Click Handlers
      gridView.querySelectorAll('.doc-view-trigger, .btn-doc-view').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          var docId = el.getAttribute('data-doc-id');
          openDocumentViewer(docId);
        });
      });

      // Delete Click Handlers
      gridView.querySelectorAll('.btn-doc-del').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          var docId = el.getAttribute('data-doc-id');
          openDocDeleteConfirm(docId, loadDocs);
        });
      });

    } catch (err) {
      gridView.innerHTML = '<div class="text-danger" style="padding:1rem;">Failed to load documents: ' + esc(err.message) + '</div>';
    }
  }

  // Upload Dialog
  if (uploadBtn) {
    uploadBtn.addEventListener('click', function () {
      openUploadSheet(entityType, entityId, entityName, loadDocs);
    });
  }

  await loadDocs();
};

function openUploadSheet(entityType, entityId, entityName, onSuccess) {
  var esc = (window.ui && window.ui.esc) ? window.ui.esc : function (s) { return String(s || ''); };

  var sheetHtml = 
    '<div style="padding:1rem;">' +
      '<h3 style="margin:0 0 1rem;font-size:1.15rem;">Upload Document — ' + esc(entityName) + '</h3>' +
      '<div class="form-field">' +
        '<label>Document Type *</label>' +
        '<select id="udoc-type" class="input">' +
          ['Aadhaar', 'GST', 'Invoice', 'Bill', 'Agreement', 'Cheque', 'Certificate', 'Bank Details', 'Other'].map(function (dt) {
            return '<option value="' + dt + '">' + dt + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="form-field">' +
        '<label>Select File (Image or PDF, max 10MB) *</label>' +
        '<input type="file" id="udoc-file" class="input" accept="image/jpeg,image/png,image/webp,application/pdf" style="padding:0.4rem;">' +
      '</div>' +
      '<div class="form-field">' +
        '<label>Caption / Notes</label>' +
        '<input type="text" id="udoc-caption" class="input" placeholder="e.g. Electricity Bill July 2026">' +
      '</div>' +
      '<div id="udoc-err" class="text-danger" style="margin-bottom:0.75rem;font-size:0.85rem;display:none;"></div>' +
      '<button type="button" id="btn-do-upload-doc" class="btn btn-primary btn-full" style="min-height:44px;">Upload Document</button>' +
    '</div>';

  window.ui.openBottomSheet('Upload Document', sheetHtml, '');

  var fileInput = document.getElementById('udoc-file');
  var docTypeSel = document.getElementById('udoc-type');
  var captionInput = document.getElementById('udoc-caption');
  var submitBtn = document.getElementById('btn-do-upload-doc');
  var errEl = document.getElementById('udoc-err');

  if (submitBtn) {
    submitBtn.addEventListener('click', async function () {
      var files = fileInput.files;
      if (!files || !files.length) {
        errEl.textContent = 'Please select a file to upload';
        errEl.style.display = 'block';
        return;
      }

      await window.ui.withButtonLoading(submitBtn, async function () {
        errEl.style.display = 'none';
        try {
          var compressed = await window.components.compressFileOrDoc(files[0]);
          var payload = {
            entity_type: entityType,
            entity_id: entityId,
            doc_type: docTypeSel.value,
            caption: captionInput.value.trim(),
            data_base64: compressed.fullBase64,
            thumb_base64: compressed.thumbBase64,
            mime_type: compressed.mimeType,
            file_name: files[0].name
          };

          await window.api.call('documents.upload', payload);
          window.ui.toast('Document uploaded successfully!', 'success');
          window.ui.closeBottomSheet();
          if (onSuccess) onSuccess();
        } catch (e) {
          errEl.textContent = e.message || 'Upload failed';
          errEl.style.display = 'block';
        }
      });
    });
  }
}

// Full Document Viewer
async function openDocumentViewer(docId) {
  var esc = (window.ui && window.ui.esc) ? window.ui.esc : function (s) { return String(s || ''); };

  var modal = document.createElement('div');
  modal.id = 'doc-full-viewer-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10002;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;';
  modal.innerHTML = '<span class="spinner" style="border-top-color:#fff;"></span>';
  document.body.appendChild(modal);

  try {
    var res = await window.api.call('documents.image', { doc_id: docId, size: 'full' });
    if (!res || !res.data_uri) throw new Error('Could not load document');

    var isPdf = res.mime_type === 'application/pdf';

    modal.innerHTML = 
      '<div style="max-width:95vw;max-height:90vh;display:flex;flex-direction:column;align-items:center;background:#fff;border-radius:12px;overflow:hidden;padding:1rem;position:relative;">' +
        '<div style="width:100%;display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
          '<span style="font-weight:700;font-size:0.95rem;">' + esc(res.file_name || 'Document') + '</span>' +
          '<button type="button" id="btn-close-viewer" style="background:none;border:none;font-size:1.5rem;cursor:pointer;padding:0.25rem 0.5rem;line-height:1;">✕</button>' +
        '</div>' +
        (isPdf ? (
          '<div style="text-align:center;padding:2rem;">' +
            '<div style="font-size:3rem;margin-bottom:1rem;">📄</div>' +
            '<p style="margin:0 0 1rem;font-size:0.9rem;">PDF Document ready for download/viewing.</p>' +
            '<a href="' + res.data_uri + '" download="' + esc(res.file_name || 'document.pdf') + '" class="btn btn-primary" style="display:inline-block;text-decoration:none;">Download / Open PDF</a>' +
          '</div>'
        ) : (
          '<img src="' + res.data_uri + '" style="max-width:100%;max-height:75vh;object-fit:contain;border-radius:6px;">'
        )) +
      '</div>';

    modal.querySelector('#btn-close-viewer').addEventListener('click', function () {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal && modal.parentNode) modal.parentNode.removeChild(modal);
    });

  } catch (err) {
    modal.innerHTML = '<div style="background:#fff;padding:1.5rem;border-radius:8px;text-align:center;">' +
      '<p class="text-danger">' + esc(err.message || 'Failed to load document') + '</p>' +
      '<button type="button" class="btn btn-secondary" onclick="this.closest(\'#doc-full-viewer-modal\').remove()">Close</button>' +
      '</div>';
  }
}

// 2-Step Delete Modal
function openDocDeleteConfirm(docId, onSuccess) {
  var esc = (window.ui && window.ui.esc) ? window.ui.esc : function (s) { return String(s || ''); };

  var modal = document.createElement('div');
  modal.id = 'doc-delete-confirm-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10003;display:flex;align-items:center;justify-content:center;padding:1rem;';

  modal.innerHTML = 
    '<div class="card" style="max-width:380px;width:100%;padding:1.25rem;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.3);">' +
      '<h3 style="color:#dc2626;margin:0 0 0.5rem;font-size:1.1rem;">⚠️ Permanently Delete Document?</h3>' +
      '<p style="font-size:0.875rem;margin:0 0 1rem;color:var(--text-main);">' +
        'This action is irreversible. The file will be permanently removed from Google Drive.' +
      '</p>' +
      '<div class="form-field" style="margin-bottom:1rem;">' +
        '<label style="font-size:0.8rem;font-weight:700;">Type <code>DELETE</code> to confirm:</label>' +
        '<input type="text" id="del-confirm-input" class="input" placeholder="DELETE" autocomplete="off" style="text-transform:uppercase;">' +
      '</div>' +
      '<div id="del-modal-err" class="text-danger" style="font-size:0.8rem;margin-bottom:0.75rem;display:none;"></div>' +
      '<div style="display:flex;gap:0.5rem;justify-content:flex-end;">' +
        '<button type="button" id="btn-cancel-del" class="btn btn-outline btn-sm" style="min-height:38px;">Cancel</button>' +
        '<button type="button" id="btn-confirm-del" class="btn btn-danger btn-sm" style="min-height:38px;" disabled>Delete Forever</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  var input = modal.querySelector('#del-confirm-input');
  var confirmBtn = modal.querySelector('#btn-confirm-del');
  var cancelBtn = modal.querySelector('#btn-cancel-del');
  var errEl = modal.querySelector('#del-modal-err');

  input.addEventListener('input', function () {
    confirmBtn.disabled = input.value.trim().toUpperCase() !== 'DELETE';
  });

  cancelBtn.addEventListener('click', function () {
    if (modal.parentNode) modal.parentNode.removeChild(modal);
  });

  confirmBtn.addEventListener('click', async function () {
    await window.ui.withButtonLoading(confirmBtn, async function () {
      try {
        await window.api.call('documents.delete', { doc_id: docId, confirm: true });
        window.ui.toast('Document permanently deleted', 'success');
        if (modal.parentNode) modal.parentNode.removeChild(modal);
        if (onSuccess) onSuccess();
      } catch (err) {
        errEl.textContent = err.message || 'Delete failed';
        errEl.style.display = 'block';
      }
    });
  });
}
