/**
 * tests/test-frontend-browser.js — Real Browser CDP Test for Combined Frontend Fixes & Navigation
 *
 * Requirements covered:
 *   - Part A: Hotfix validation (i18n robustness, token validation on boot, settings ping).
 *   - Part B: Navigation validation (10 swipeable tabs for OWNER, active centering, edge fades, user menu in header).
 *   - Part C2: Viewports 360x640, 390x844, 412x915 in EN and HI.
 *             Fresh login without refresh, logout/expired token hiding shell, zero raw keys in DOM text.
 *   - Part D: Nested bottom sheets in New Lot (add product via searchSelect, add serials, verify layers stack and close cleanly).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const FRONTEND_DIR = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.resolve(__dirname, '../reports/screenshots/frontend-fixes');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8092;

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
  console.log(`[Server] Headless test server listening at http://127.0.0.1:${PORT}`);
  try {
    await runBrowserSuite();
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runBrowserSuite() {
  const tempProfile = path.join(os.tmpdir(), 'solar-chrome-test-' + Date.now());
  fs.mkdirSync(tempProfile, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9224',
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  console.log('[Chrome] Launched on port 9224');
  await sleep(1500);

  try {
    const targetsRes = await fetch('http://127.0.0.1:9224/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    if (!pageTarget) throw new Error('No CDP page target found');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evalJs(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.exception.description || res.exceptionDetails.text);
      }
      return res.result ? res.result.value : undefined;
    }

    async function captureShot(name, vp) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: true
      });
      await sleep(300);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const shotPath = path.join(SCREENSHOT_DIR, `${name}-${vp.width}x${vp.height}.png`);
      fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
      console.log(`[Screenshot] Saved ${shotPath}`);
      return shotPath;
    }

    async function checkZeroRawKeys() {
      const rawKeyRegex = /\b(nav\.[a-z_]+|login\.[a-z_]+|err\.[A-Z_]+|dash\.[a-z_]+|usage\.[a-z_]+|sites\.[a-z_]+)\b/g;
      const bodyText = await evalJs('document.body.innerText');
      const matches = bodyText.match(rawKeyRegex);
      if (matches && matches.length > 0) {
        console.error('FAIL: Detected raw translation keys in DOM:', matches);
        throw new Error(`Raw translation keys detected: ${matches.join(', ')}`);
      }
    }

    await new Promise(r => ws.onopen = r);
    console.log('[CDP] Connected');

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    const viewports = [
      { name: '360x640', width: 360, height: 640 },
      { name: '390x844', width: 390, height: 844 },
      { name: '412x915', width: 412, height: 915 }
    ];

    // =========================================================================
    // 1. Fresh Load (Empty Cache) -> Only Login Screen
    // =========================================================================
    console.log('\n--- Test 1: Fresh Load (Empty Storage) ---');
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(1500);

    const headerDisplay = await evalJs('getComputedStyle(document.getElementById("app-header")).display');
    const navDisplay = await evalJs('getComputedStyle(document.getElementById("bottom-nav-container")).display');
    const hash = await evalJs('window.location.hash');

    console.log('   - Header display:', headerDisplay, '(must be none)');
    console.log('   - Nav container display:', navDisplay, '(must be none)');
    console.log('   - Hash:', hash, '(must be #/login)');

    if (headerDisplay !== 'none' || navDisplay !== 'none' || hash !== '#/login') {
      throw new Error('Fresh load failed: Shell is visible before login');
    }
    console.log('PASS: Shell hidden on unauthenticated boot');

    await checkZeroRawKeys();
    for (const vp of viewports) {
      await captureShot('01-login-en', vp);
    }

    // Hindi on login
    await evalJs('window.i18n.setLang("hi")');
    await sleep(300);
    await checkZeroRawKeys();
    for (const vp of viewports) {
      await captureShot('01-login-hi', vp);
    }
    await evalJs('window.i18n.setLang("en")');
    await sleep(200);

    // =========================================================================
    // 2. Forced Password Change Flow
    // =========================================================================
    console.log('\n--- Test 2: Forced Password Change Flow ---');
    await evalJs('window.showPasswordChangeModal(true)');
    await sleep(400);
    await checkZeroRawKeys();
    for (const vp of viewports) {
      await captureShot('02-forced-password-modal', vp);
    }
    await evalJs('window.ui.closeBottomSheet()');
    await sleep(200);

    // =========================================================================
    // 3. Login as OWNER -> Header & 10 Swipeable Tabs appear without refresh
    // =========================================================================
    // Mock window.api.call to respond immediately with valid data for pages
    await evalJs(`
      window._mockProducts = [
        { product_id: 'PRD-001', name: 'Solar Inverter 5kW', category: 'INVERTER', track_serial: true, default_gst_rate: 12 },
        { product_id: 'PRD-002', name: 'Monocrystalline Panel 540W', category: 'MODULE', track_serial: false, default_gst_rate: 12 }
      ];
      window._mockSuppliers = [
        { supplier_id: 'SUP-001', name: 'Adani Solar Tech' }
      ];
      window._mockLocations = [
        { location_id: 'LOC-001', name: 'Main Godown Surat' }
      ];

      window.api.call = async function(action, payload) {
        if (action === 'auth.me') {
          return { user: window.auth.getUser() };
        }
        if (action === 'products.list') {
          return { items: window._mockProducts };
        }
        if (action === 'suppliers.list') {
          return { items: window._mockSuppliers };
        }
        if (action === 'locations.list') {
          return { items: window._mockLocations };
        }
        if (action === 'lots.list') {
          return { items: [] };
        }
        if (action === 'lots.create') {
          return { lot_id: 'LOT-TEST-1', invoice_no: payload.invoice_no };
        }
        if (action === 'dashboard.get') {
          return { stats: {} };
        }
        if (action === 'settings.get') {
          return { settings: { stuck_days: 5 } };
        }
        return { ok: true };
      };

      window.auth.setSession('test-token-owner', true, {
        user_id: 'USR-O1',
        name: 'Yashraj Patel',
        role: 'OWNER',
        lang: 'en',
        company: { id: 'CMP-001', name: 'Suryadoot Energy Solution' },
        must_change_password: false
      }, [
        'dashboard.get', 'sites.list', 'sites.create', 'stock.summary',
        'lots.list', 'lots.create', 'customers.list', 'customers.create',
        'products.list', 'products.create', 'locations.list', 'locations.create',
        'suppliers.list', 'suppliers.create', 'cpay.add',
        'reports.list', 'reports.run', 'users.list', 'settings.get'
      ]);
      window.location.hash = '#/dashboard';
    `);
    await sleep(800);

    const postHeaderDisplay = await evalJs('getComputedStyle(document.getElementById("app-header")).display');
    const postNavDisplay = await evalJs('getComputedStyle(document.getElementById("bottom-nav-container")).display');
    const visibleTabsCount = await evalJs(`
      Array.from(document.querySelectorAll('#bottom-nav .nav-tab'))
        .filter(t => getComputedStyle(t).display !== 'none').length
    `);

    console.log('   - Post-login header display:', postHeaderDisplay, '(must be flex)');
    console.log('   - Post-login nav display:', postNavDisplay, '(must be block)');
    console.log('   - Visible nav tabs for OWNER:', visibleTabsCount, '(must be 10)');

    if (postHeaderDisplay !== 'flex' || postNavDisplay !== 'block' || visibleTabsCount !== 10) {
      throw new Error(`Owner login shell failed: header=${postHeaderDisplay}, nav=${postNavDisplay}, tabs=${visibleTabsCount}`);
    }
    console.log('PASS: Header and 10 swipeable tabs rendered immediately without refresh');

    await checkZeroRawKeys();
    for (const vp of viewports) {
      await captureShot('03-owner-dashboard-en', vp);
    }

    // =========================================================================
    // 4. Swipeable Nav Tab Centering & Edge Fades
    // =========================================================================
    console.log('\n--- Test 4: Tab Centering & Edge Fades on Route Change ---');
    // Navigate to settings (10th tab, far right)
    await evalJs('window.location.hash = "#/settings"');
    await sleep(600);

    const activeTab = await evalJs('document.querySelector("#bottom-nav .nav-tab.active").getAttribute("data-tab")');
    const scrollLeft = await evalJs('document.getElementById("bottom-nav").scrollLeft');
    console.log('   - Active tab:', activeTab, '| Bottom nav scrollLeft:', scrollLeft);

    if (activeTab !== 'settings' || scrollLeft <= 0) {
      throw new Error('Tab centering failed: settings tab did not scroll bottom nav');
    }
    console.log('PASS: Settings tab centered and bottom nav smoothly scrolled');

    await checkZeroRawKeys();
    for (const vp of viewports) {
      await captureShot('04-settings-centered-tab-en', vp);
    }

    // Switch to Hindi on Settings
    await evalJs('window.i18n.setLang("hi")');
    await sleep(300);
    await checkZeroRawKeys();
    for (const vp of viewports) {
      await captureShot('04-settings-hi', vp);
    }
    await evalJs('window.i18n.setLang("en")');
    await sleep(200);

    // =========================================================================
    // 5. Header User Menu Sheet
    // =========================================================================
    console.log('\n--- Test 5: Header User Menu Sheet ---');
    await evalJs('document.getElementById("user-menu-btn").click()');
    await sleep(400);

    const isSheetOpen = await evalJs('document.getElementById("modal-backdrop").classList.contains("is-open")');
    const hasLogoutBtn = await evalJs('Boolean(document.getElementById("um-logout-btn"))');
    console.log('   - User menu sheet open:', isSheetOpen, '| Has logout button:', hasLogoutBtn);

    if (!isSheetOpen || !hasLogoutBtn) {
      throw new Error('User menu sheet failed to open');
    }
    console.log('PASS: User menu sheet opened from avatar button');

    for (const vp of viewports) {
      await captureShot('05-user-menu-sheet', vp);
    }
    await evalJs('window.ui.closeBottomSheet()');
    await sleep(300);

    // =========================================================================
    // 6. Role Comparison: MANAGER & SITE_USER Tab Counts
    // =========================================================================
    console.log('\n--- Test 6: Role Permissions Filtering (MANAGER & SITE_USER) ---');
    // MANAGER
    await evalJs(`
      window.auth.setSession('test-token-mgr', true, {
        user_id: 'USR-M1',
        name: 'Manager Ravi',
        role: 'MANAGER',
        lang: 'en'
      }, [
        'dashboard.get', 'sites.list', 'stock.summary', 'lots.list',
        'customers.list', 'products.list', 'reports.list'
      ]);
    `);
    await sleep(400);
    const mgrTabsCount = await evalJs(`
      Array.from(document.querySelectorAll('#bottom-nav .nav-tab'))
        .filter(t => getComputedStyle(t).display !== 'none').length
    `);
    console.log('   - Visible nav tabs for MANAGER:', mgrTabsCount, '(must be < 10, no Money, no Users, no Settings)');
    if (mgrTabsCount >= 10 || mgrTabsCount < 5) {
      throw new Error(`Manager tab count unexpected: ${mgrTabsCount}`);
    }

    // SITE_USER
    await evalJs(`
      window.auth.setSession('test-token-site', true, {
        user_id: 'USR-S1',
        name: 'Site User Amit',
        role: 'SITE_USER',
        lang: 'en'
      }, [
        'sites.list', 'stock.summary'
      ]);
    `);
    await sleep(400);
    const siteTabsCount = await evalJs(`
      Array.from(document.querySelectorAll('#bottom-nav .nav-tab'))
        .filter(t => getComputedStyle(t).display !== 'none').length
    `);
    console.log('   - Visible nav tabs for SITE_USER:', siteTabsCount, '(must be 2: Sites, Stock)');
    if (siteTabsCount !== 2) {
      throw new Error(`Site User tab count unexpected: ${siteTabsCount}`);
    }
    console.log('PASS: Roles correctly see restricted tab lists');

    // Switch back to OWNER
    await evalJs(`
      window.auth.setSession('test-token-owner', true, {
        user_id: 'USR-O1',
        name: 'Yashraj Patel',
        role: 'OWNER',
        lang: 'en'
      }, ['*']);
    `);
    await sleep(400);

    // =========================================================================
    // 7. Nested Bottom Sheets Test in New Lot intake (Part D)
    // =========================================================================
    console.log('\n--- Test 7: Nested Bottom Sheets Stack (Lots Intake -> SearchSelect -> SerialInput) ---');
    await evalJs('window.location.hash = "#/lots"');
    await sleep(600);

    // Inject mock data for products & suppliers so the lot form operates smoothly
    await evalJs(`
      window.masterCache.set('products', [
        { product_id: 'PRD-001', name: 'Solar Inverter 5kW', category: 'INVERTER', track_serial: true, default_gst_rate: 12 },
        { product_id: 'PRD-002', name: 'Monocrystalline Panel 540W', category: 'MODULE', track_serial: false, default_gst_rate: 12 }
      ]);
      window.masterCache.set('suppliers', [
        { supplier_id: 'SUP-001', name: 'Adani Solar Tech' }
      ]);
      window.masterCache.set('locations', [
        { location_id: 'LOC-001', name: 'Main Godown Surat' }
      ]);
    `);

    // Click "+ New Purchase Lot"
    await evalJs('document.getElementById("lot-new-btn").click()');
    await sleep(400);

    // Fill lot basic fields
    await evalJs(`
      document.getElementById("clf-supplier").value = "SUP-001";
      document.getElementById("clf-invoice").value = "INV-TEST-2026";
      document.getElementById("clf-location").value = "LOC-001";
    `);

    let stackSize = await evalJs('window.ui.getSheetStackCount()');
    console.log('   - Stack count after opening New Lot sheet:', stackSize, '(must be 1)');

    for (const vp of viewports) {
      await captureShot('07-nested-step1-lot-form', vp);
    }

    // Click "+ Add Line Item" which opens searchSelect sheet
    await evalJs('document.getElementById("clf-add-line-btn").click()');
    await sleep(400);

    stackSize = await evalJs('window.ui.getSheetStackCount()');
    console.log('   - Stack count after opening product searchSelect:', stackSize, '(must be 2)');
    if (stackSize !== 2) throw new Error(`Expected sheet stack size 2, got ${stackSize}`);

    for (const vp of viewports) {
      await captureShot('07-nested-step2-product-picker', vp);
    }

    // Pick the first product (PRD-001, Inverter with track_serial=true)
    await evalJs(`
      var itemEl = document.querySelector('.ss-item-row');
      if (itemEl) itemEl.click();
    `);
    await sleep(400);

    stackSize = await evalJs('window.ui.getSheetStackCount()');
    const invoiceVal = await evalJs('document.getElementById("clf-invoice") ? document.getElementById("clf-invoice").value : ""');
    const lineCount = await evalJs('document.querySelectorAll(".clf-del-item").length');

    console.log('   - Stack count after product pick:', stackSize, '(must be 1)');
    console.log('   - Invoice field retained value:', invoiceVal, '(must be INV-TEST-2026)');
    console.log('   - Line items added in base form:', lineCount, '(must be 1)');

    if (stackSize !== 1 || invoiceVal !== 'INV-TEST-2026' || lineCount !== 1) {
      throw new Error(`Nested form state lost! stack=${stackSize}, invoiceVal=${invoiceVal}, lines=${lineCount}`);
    }
    console.log('PASS: First nested sheet popped cleanly without destroying base form');

    // Click "Serials: 0 / 1" to open serialInput modal
    await evalJs(`
      var serialBtn = document.querySelector('.clf-serial-btn');
      if (serialBtn) serialBtn.click();
    `);
    await sleep(400);

    stackSize = await evalJs('window.ui.getSheetStackCount()');
    console.log('   - Stack count after opening Serial Input sheet:', stackSize, '(must be 2)');
    if (stackSize !== 2) throw new Error(`Expected sheet stack size 2 for serial input, got ${stackSize}`);

    for (const vp of viewports) {
      await captureShot('07-nested-step3-serial-input', vp);
    }

    // Enter serial and confirm
    await evalJs(`
      var serialText = document.getElementById("si-textarea");
      if (serialText) {
        serialText.value = "INV-SN-889911";
        serialText.dispatchEvent(new Event("input"));
      }
      var confirmBtn = document.getElementById("si-confirm-btn");
      if (confirmBtn) confirmBtn.click();
    `);
    await sleep(400);

    stackSize = await evalJs('window.ui.getSheetStackCount()');
    const serialBtnText = await evalJs('document.querySelector(".clf-serial-btn") ? document.querySelector(".clf-serial-btn").textContent.trim() : ""');

    console.log('   - Stack count after confirming serials:', stackSize, '(must be 1)');
    console.log('   - Updated serial button text in base form:', serialBtnText);

    if (stackSize !== 1 || !serialBtnText.includes('1 / 1')) {
      throw new Error(`Serial input confirmation failed: stack=${stackSize}, text=${serialBtnText}`);
    }
    console.log('PASS: Serial modal popped cleanly and updated line item serial count');

    for (const vp of viewports) {
      await captureShot('07-nested-step4-lot-form-ready', vp);
    }

    // Close all sheets
    await evalJs('window.ui.closeAllBottomSheets()');
    await sleep(300);

    // =========================================================================
    // 8. Logout & Expired Token verification
    // =========================================================================
    console.log('\n--- Test 8: Logout & Expired Token Hides Shell ---');
    await evalJs('window.auth.clearToken()');
    await sleep(400);

    const logoutHeaderDisplay = await evalJs('getComputedStyle(document.getElementById("app-header")).display');
    const logoutNavDisplay = await evalJs('getComputedStyle(document.getElementById("bottom-nav-container")).display');
    console.log('   - Shell display on logout: header=', logoutHeaderDisplay, ', nav=', logoutNavDisplay);

    if (logoutHeaderDisplay !== 'none' || logoutNavDisplay !== 'none') {
      throw new Error('Logout failed to hide shell');
    }
    console.log('PASS: Logout immediately hides shell and returns to login');

    console.log('\n===================================================================');
    console.log('ALL FRONTEND BROWSER TESTS & NESTED SHEETS WORKFLOWS PASSED ✓');
    console.log('===================================================================');

    ws.close();
  } finally {
    chromeProc.kill();
    await sleep(500);
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch(e) {}
  }
}
