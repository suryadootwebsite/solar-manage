/**
 * import-stock.js — Opening Stock Import Screen (Doc 06 S20).
 * Accessible by OWNER only.
 */

window.pages = window.pages || {};

window.pages.importStock = async function(container) {
  var t = window.i18n.t;

  container.innerHTML = `
    <div style="margin-bottom:1rem;">
      <h2 style="margin:0;">Opening Stock Import</h2>
      <p class="text-muted" style="margin:0.25rem 0 0; font-size:0.875rem;">Initial inventory migration and dry-run reconciliation</p>
    </div>

    <div class="card" style="margin-bottom:1rem;">
      <p style="font-size:0.875rem; color:var(--text-muted); margin:0 0 0.5rem 0;">
        Paste CSV or tab-delimited text. Columns expected:<br>
        <code>product_name, brand, model, location, qty, rate, serial_numbers</code>
      </p>
      <textarea id="osi-text" class="input" rows="8" placeholder="e.g.&#10;Solar Panel 540W, Tata, TP-540, Godown A, 20, 15000, SN101;SN102&#10;Inverter 5kW, Growatt, GW-5K, Godown A, 5, 45000, "></textarea>
      <div style="display:flex; justify-content:flex-end; margin-top:0.75rem;">
        <button id="osi-dryrun-btn" class="btn btn-primary" style="min-height:44px;">Run Dry-Run Validation</button>
      </div>
    </div>

    <div id="osi-results-view"></div>
  `;

  var textarea = document.getElementById('osi-text');
  var dryrunBtn = document.getElementById('osi-dryrun-btn');
  var resultsView = document.getElementById('osi-results-view');

  dryrunBtn.onclick = function() {
    var raw = textarea.value.trim();
    if (!raw) {
      window.ui.toast('Please enter rows to validate', 'warning');
      return;
    }

    var lines = raw.split(/\r?\n/).filter(function(l) { return l.trim().length > 0; });
    var parsedRows = lines.map(function(line) {
      var parts = line.split(/[,\t]+/).map(function(p) { return p.trim(); });
      return {
        product_name:   parts[0] || '',
        brand:          parts[1] || '',
        model:          parts[2] || '',
        location:       parts[3] || '',
        qty:            parseInt(parts[4], 10) || 0,
        rate:           parseFloat(parts[5]) || 0,
        serial_numbers: parts[6] || ''
      };
    });

    window.ui.withButtonLoading(dryrunBtn, async function() {
      try {
        var res = await window.api.call('stock.import.dryRun', { rows: parsedRows });
        renderResults(res);
      } catch(err) {
        resultsView.innerHTML = `<div class="card text-error">${window.ui.esc(err.message || 'Validation failed')}</div>`;
      }
    });
  };

  function renderResults(res) {
    if (!res.valid) {
      var errList = (res.errors || []).map(function(e) {
        return `<li>Row ${e.row}: <strong>${window.ui.esc(e.field)}</strong> — ${window.ui.esc(e.message)}</li>`;
      }).join('');

      resultsView.innerHTML = `
        <div class="card" style="border-left:4px solid var(--danger, #dc2626); margin-bottom:1rem;">
          <h3 style="color:var(--danger, #dc2626); margin:0 0 0.5rem 0;">Validation Errors (${res.error_count})</h3>
          <ul style="margin:0; padding-left:1.25rem; font-size:0.875rem;">
            ${errList}
          </ul>
        </div>
      `;
      return;
    }

    var validRows = res.ok_rows || [];
    var previewTable = validRows.slice(0, 10).map(function(r) {
      return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:0.5rem;">${window.ui.esc(r.product_name)}</td>
          <td style="padding:0.5rem;">${window.ui.esc(r.location_name)}</td>
          <td style="padding:0.5rem; text-align:right;">${r.qty}</td>
          <td style="padding:0.5rem; text-align:right;">₹${(r.rate_paise / 100).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    resultsView.innerHTML = `
      <div class="card" style="border-left:4px solid var(--success, #16a34a); margin-bottom:1rem;">
        <h3 style="color:var(--success, #16a34a); margin:0 0 0.5rem 0;">All ${res.ok_count} Rows Validated Successfully</h3>
        <p class="text-muted" style="font-size:0.875rem;">Preview (first 10 items):</p>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
            <thead>
              <tr style="border-bottom:2px solid var(--border); text-align:left;">
                <th style="padding:0.5rem;">Product</th>
                <th style="padding:0.5rem;">Godown</th>
                <th style="padding:0.5rem; text-align:right;">Qty</th>
                <th style="padding:0.5rem; text-align:right;">Rate</th>
              </tr>
            </thead>
            <tbody>
              ${previewTable}
            </tbody>
          </table>
        </div>
        <div style="margin-top:1.5rem;">
          <button id="osi-commit-btn" class="btn btn-primary btn-full" style="min-height:44px;">Commit Opening Stock to Database</button>
        </div>
      </div>
    `;

    document.getElementById('osi-commit-btn').onclick = function() {
      var commitBtn = document.getElementById('osi-commit-btn');
      window.ui.withButtonLoading(commitBtn, async function() {
        try {
          var cRes = await window.api.call('stock.import.commit', {
            rows: validRows,
            import_token: res.import_token
          });
          window.ui.toast('Opening stock committed successfully! Lot ID: ' + cRes.lot_id, 'success');
          resultsView.innerHTML = `
            <div class="card" style="text-align:center; padding:2rem 1rem;">
              <h3 style="color:var(--success, #16a34a);">Import Complete</h3>
              <p class="text-muted">Created Lot: <strong>${cRes.lot_id}</strong> (${cRes.batches_count} batches, ${cRes.serials_count} serials)</p>
              <button class="btn btn-primary" onclick="window.location.hash='#/stock'">View Stock</button>
            </div>
          `;
        } catch(err) {
          window.ui.toast(err.message || 'Commit failed', 'error');
        }
      });
    };
  }
};
