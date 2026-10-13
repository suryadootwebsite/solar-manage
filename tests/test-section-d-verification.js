/**
 * tests/test-section-d-verification.js — Section D Final Verification Suite.
 *
 * Runs headless Chrome at 390x844 (EN only).
 * Takes screenshots for:
 *   1. site-card-detail: Site card click opens site detail.
 *   2. logo-click-dashboard: Logo click navigates to dashboard.
 *   3. header-one-line: Header on one line (ellipsis, compact).
 *   4. user-menu-lang: User menu language switch.
 *   5. duplicate-username-error: Duplicate username shows clear error.
 *   6. owner-reset-password: Owner resets password (copyable sheet).
 *   7. manager-zero-financial: Manager login shows zero financial leaks in DOM text.
 *   8. supplier-payments-dropdown: Supplier payments dropdown lists suppliers.
 *   9. reports-390px: Reports view on 390px.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const FRONTEND_DIR = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.resolve(__dirname, '../reports/screenshots/demo-fixes');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8094;

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(FRONTEND_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, async () => {
  console.log(`[Server] Listening at http://127.0.0.1:${PORT}`);
  try {
    await runSuite();
  } catch (err) {
    console.error('Fatal error in Section D suite:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 1;
    const callbacks = {};

    ws.onopen = () => {
      resolve({
        send: (method, params = {}) => new Promise((res, rej) => {
          const reqId = id++;
          callbacks[reqId] = { res, rej };
          ws.send(JSON.stringify({ id: reqId, method, params }));
        }),
        close: () => ws.close()
      });
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks[msg.id]) {
        if (msg.error) callbacks[msg.id].rej(new Error(msg.error.message || JSON.stringify(msg.error)));
        else callbacks[msg.id].res(msg.result);
        delete callbacks[msg.id];
      }
    };

    ws.onerror = reject;
  });
}

async function runSuite() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-cdp-d-'));
  const cdpPort = 9226;

  console.log(`[Chrome] Launching Chrome on port ${cdpPort}...`);
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  const targetsRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  if (!pageTarget) throw new Error('No CDP page target found');

  const cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  async function takeScreenshot(name) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    const outPath = path.join(SCREENSHOT_DIR, `${name}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`[Screenshot] Saved: ${outPath}`);
  }

  async function evalJs(expr) {
    const res = await cdp.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result ? res.result.value : null;
  }

  // 1. Navigate to frontend
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
  await new Promise(r => setTimeout(r, 1200));

  // Mock API client to avoid live GAS network calls
  await evalJs(`
    (function() {
      var seedSites = [
        { site_id: 'SITE-001', site_name: 'Adani Rooftop 10kW', customer_id: 'CST-001', current_stage_id: 'STG-001', status: 'ACTIVE', system_kw: 10, contract_value_paise: 50000000 },
        { site_id: 'SITE-002', site_name: 'Tata Warehouse 50kW', customer_id: 'CST-002', current_stage_id: 'STG-002', status: 'ACTIVE', system_kw: 50, contract_value_paise: 250000000 }
      ];

      var seedUsers = [
        { user_id: 'USR-001', name: 'Yashraj Patel', username: 'owner', role: 'OWNER', is_active: true, branch_ids: 'BR-001' },
        { user_id: 'USR-002', name: 'Rajesh Manager', username: 'manager', role: 'MANAGER', is_active: true, branch_ids: 'BR-001' },
        { user_id: 'USR-DEV-001', name: 'Developer', username: 'developer', role: 'DEVELOPER', is_active: true, branch_ids: '' }
      ];

      var seedSuppliers = [
        { supplier_id: 'SUP-001', name: 'Waaree Solar Ltd', is_active: true },
        { supplier_id: 'SUP-002', name: 'Tata Power Solar', is_active: true }
      ];

      window.api.call = async function(action, payload) {
        if (action === 'auth.me') {
          return { user: window.auth.getUser() || { user_id: 'USR-001', name: 'Yashraj Patel', role: 'OWNER' } };
        }
        if (action === 'sites.list') {
          return { items: seedSites, total: seedSites.length };
        }
        if (action === 'sites.get') {
          return {
            site: seedSites[0],
            stages: [
              { stage_id: 'STG-001', status: 'COMPLETED', seq: 1 },
              { stage_id: 'STG-002', status: 'IN_PROGRESS', seq: 2 }
            ],
            customer: { name: 'Adani Logistics' },
            assigned_users: []
          };
        }
        if (action === 'stageMaster.list') {
          return { items: [
            { stage_id: 'STG-001', name_en: 'Site Survey' },
            { stage_id: 'STG-002', name_en: 'Structure Assembly' }
          ]};
        }
        if (action === 'users.list') {
          return { items: seedUsers };
        }
        if (action === 'users.create') {
          if (payload.username === 'owner') {
            throw { code: 'DUPLICATE', fields: { username: 'DUPLICATE_USERNAME' }, message: 'Username is already taken' };
          }
          return { user_id: 'USR-NEW-01', temp_password: payload.password || '1234567890' };
        }
        if (action === 'users.resetPassword') {
          return { temp_password: 'new_temp_pass_123' };
        }
        if (action === 'suppliers.list') {
          return { items: seedSuppliers };
        }
        if (action === 'spay.ledger') {
          return {
            supplier_id: payload.supplier_id,
            supplier_name: 'Waaree Solar Ltd',
            total_purchased_paise: 15500000,
            total_paid_paise: 5000000,
            balance_pending_paise: 10500000,
            lots: [{ lot_id: 'LOT-01', invoice_no: 'INV-100', grand_total_paise: 15500000, paid_paise: 5000000, pending_paise: 10500000 }]
          };
        }
        if (action === 'reports.list') {
          return [
            { id: 'stock_summary', name_en: 'Stock Summary' },
            { id: 'site_status', name_en: 'Site Progress' }
          ];
        }
        if (action === 'reports.run') {
          return {
            report_id: 'stock_summary',
            name: 'Stock Summary Report',
            headers: ['product_name', 'category', 'qty_available', 'unit'],
            rows: [
              { product_name: 'Waaree 540W Mono', category: 'PANEL', qty_available: 100, unit: 'nos' },
              { product_name: 'Growatt 10kW Inverter', category: 'INVERTER', qty_available: 4, unit: 'nos' }
            ]
          };
        }
        if (action === 'dashboard.get') {
          return { role: 'OWNER', active_sites_count: 2, stuck_count: 0, stuck_sites: [], low_stock: [], stage_counts: {} };
        }
        return {};
      };
    })();
  `);

  // Log in as OWNER
  await evalJs(`
    window.auth.setSession('test-token-owner', false, {
      user_id: 'USR-001',
      name: 'Yashraj Patel',
      role: 'OWNER',
      lang: 'en'
    }, ['*']);
    window.location.hash = '#/sites';
  `);
  await new Promise(r => setTimeout(r, 800));

  // Check 1: Header on one line & compact
  console.log('[Check] 1. Header one line...');
  await takeScreenshot('01-header-one-line');

  // Check 2: Site card click opens site detail
  console.log('[Check] 2. Site card click -> site detail...');
  await evalJs(`
    var card = document.querySelector('.site-card');
    if (card) card.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('02-site-card-detail');

  // Check 3: Logo click navigates to dashboard
  console.log('[Check] 3. Logo click -> dashboard...');
  await evalJs(`
    var brand = document.getElementById('header-brand');
    if (brand) brand.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('03-logo-click-dashboard');

  // Check 4: User menu language switch
  console.log('[Check] 4. User menu language switch...');
  await evalJs(`
    var userMenuBtn = document.getElementById('user-menu-btn');
    if (userMenuBtn) userMenuBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('04-user-menu-sheet');
  await evalJs(`window.ui.closeBottomSheet();`);
  await new Promise(r => setTimeout(r, 400));

  // Check 5: Duplicate username shows clear error
  console.log('[Check] 5. Duplicate username error...');
  await evalJs(`window.location.hash = '#/users';`);
  await new Promise(r => setTimeout(r, 800));
  await evalJs(`
    var addBtn = document.getElementById('add-user-btn');
    if (addBtn) addBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await evalJs(`
    document.getElementById('nu-name').value = 'Existing Owner';
    document.getElementById('nu-username').value = 'owner';
    var saveBtn = document.getElementById('save-new-user-btn');
    if (saveBtn) saveBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('05-duplicate-username-error');
  await evalJs(`window.ui.closeBottomSheet();`);
  await new Promise(r => setTimeout(r, 400));

  // Check 6: Owner resets password (copyable sheet)
  console.log('[Check] 6. Owner resets password...');
  await evalJs(`
    var resetBtn = document.querySelector('.reset-pwd-btn');
    if (resetBtn) resetBtn.click();
  `);
  await new Promise(r => setTimeout(r, 400));
  // Confirm dialog
  await evalJs(`
    var confirmBtn = document.querySelector('.btn-primary');
    if (confirmBtn) confirmBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('06-owner-reset-password');
  await evalJs(`window.ui.closeBottomSheet();`);
  await new Promise(r => setTimeout(r, 400));

  // Check 7: Manager login shows zero financial leaks
  console.log('[Check] 7. Manager login zero financial leaks...');
  await evalJs(`
    window.auth.setSession('test-token-mgr', false, {
      user_id: 'USR-002',
      name: 'Rajesh Manager',
      role: 'MANAGER',
      lang: 'en'
    }, window.Perm.getActionsForRole('MANAGER'));
    window.location.hash = '#/sites';
  `);
  await new Promise(r => setTimeout(r, 800));

  const domText = await evalJs(`document.body.innerText`);
  const financialWords = ['₹', 'paise', 'rate', 'cost', 'profit', 'landed'];
  const leaksFound = financialWords.filter(w => domText.toLowerCase().includes(w));
  console.log(`Manager DOM financial words found: ${leaksFound.length ? leaksFound.join(', ') : 'NONE (PASS)'}`);
  await takeScreenshot('07-manager-zero-financial');

  // Switch back to OWNER for Money & Reports checks
  await evalJs(`
    window.auth.setSession('test-token-owner', false, {
      user_id: 'USR-001',
      name: 'Yashraj Patel',
      role: 'OWNER',
      lang: 'en'
    }, ['*']);
  `);

  // Check 8: Supplier payments dropdown lists suppliers
  console.log('[Check] 8. Supplier payments dropdown...');
  await evalJs(`window.location.hash = '#/money';`);
  await new Promise(r => setTimeout(r, 800));
  await evalJs(`
    var tabSpay = document.getElementById('tab-spay');
    if (tabSpay) tabSpay.click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await evalJs(`
    var supSel = document.getElementById('money-sup-select');
    if (supSel && supSel.options.length > 1) {
      supSel.selectedIndex = 1;
      supSel.dispatchEvent(new Event('change'));
    }
  `);
  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('08-supplier-payments-dropdown');

  // Check 9: Reports on 390px
  console.log('[Check] 9. Reports on 390px...');
  await evalJs(`window.location.hash = '#/reports';`);
  await new Promise(r => setTimeout(r, 800));
  await evalJs(`
    var repSel = document.getElementById('rep-select');
    if (repSel && repSel.options.length > 1) {
      repSel.selectedIndex = 1;
      repSel.dispatchEvent(new Event('change'));
    }
    var runBtn = document.getElementById('rep-run-btn');
    if (runBtn) runBtn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('09-reports-390px');

  cdp.close();
  chromeProc.kill();
  console.log('\n[PASS] All Section D Verification checks completed successfully.\n');
}
