const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');

console.log('=== Step 1: Validating Locales ===');
const enPath = path.join(baseDir, 'locales/en.json');
const hiPath = path.join(baseDir, 'locales/hi.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const hi = JSON.parse(fs.readFileSync(hiPath, 'utf8'));

const enKeys = Object.keys(en);
const hiKeys = Object.keys(hi);

console.log('EN keys count:', enKeys.length);
console.log('HI keys count:', hiKeys.length);

const missingInHi = enKeys.filter(k => !hi.hasOwnProperty(k));
const missingInEn = hiKeys.filter(k => !en.hasOwnProperty(k));

if (missingInHi.length > 0) console.error('Missing in HI:', missingInHi);
if (missingInEn.length > 0) console.error('Missing in EN:', missingInEn);

if (missingInHi.length === 0 && missingInEn.length === 0) {
  console.log('Locale parity: 100% PASS (Zero missing keys)');
} else {
  process.exit(1);
}

console.log('\n=== Step 2: Validating Service Worker Shell Assets ===');
const swContent = fs.readFileSync(path.join(baseDir, 'service-worker.js'), 'utf8');
const match = swContent.match(/SHELL_ASSETS\s*=\s*\[([\s\S]*?)\];/);
if (!match) throw new Error('SHELL_ASSETS not found in service-worker.js');

const rawAssets = match[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
let allExist = true;

rawAssets.forEach(asset => {
  if (asset === './') return;
  const filePath = path.join(baseDir, asset.replace(/^\.\//, ''));
  const exists = fs.existsSync(filePath);
  if (!exists) {
    console.error('MISSING ASSET:', asset, 'at', filePath);
    allExist = false;
  } else {
    console.log('OK asset:', asset);
  }
});

if (allExist) {
  console.log('All SHELL_ASSETS exist on disk: PASS');
} else {
  process.exit(1);
}

console.log('\n=== Step 3: Validating Manifest.json and Icons ===');
const manifest = JSON.parse(fs.readFileSync(path.join(baseDir, 'manifest.json'), 'utf8'));
console.log('PWA name:', manifest.name);
console.log('PWA display:', manifest.display);
console.log('PWA theme_color:', manifest.theme_color);

const iconSrcs = manifest.icons.map(i => i.src);
console.log('Manifest icons:', iconSrcs);
const requiredIcons = [
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable.png'
];
for (const icon of requiredIcons) {
  if (!iconSrcs.includes(icon)) {
    console.error('Missing required icon in manifest:', icon);
    process.exit(1);
  }
  const iconPath = path.join(baseDir, icon);
  if (!fs.existsSync(iconPath)) {
    console.error('Icon file not found on disk:', iconPath);
    process.exit(1);
  }
}
console.log('Manifest and icons: PASS');

console.log('\n=== Step 4: Validating CSP and ZERO Inline Scripts in index.html ===');
const indexHtml = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
const hasCsp = indexHtml.includes('http-equiv="Content-Security-Policy"');
const hasViewportFit = indexHtml.includes('viewport-fit=cover');
const hasAppleIcon = indexHtml.includes('rel="apple-touch-icon"');

console.log('CSP meta present:', hasCsp);
console.log('viewport-fit=cover present:', hasViewportFit);
console.log('apple-touch-icon link present:', hasAppleIcon);

if (!hasCsp || !hasViewportFit || !hasAppleIcon) {
  console.error('Missing required head meta tags or apple-touch-icon');
  process.exit(1);
}

// Strict check: NO inline <script> tags without src attribute
const inlineScriptRegex = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
const inlineMatches = [];
let m;
while ((m = inlineScriptRegex.exec(indexHtml)) !== null) {
  // Ignore purely empty whitespace tags if any, but any code is a violation
  if (m[1].trim().length > 0) {
    inlineMatches.push(m[0]);
  }
}

if (inlineMatches.length > 0) {
  console.error('FAIL: Found inline <script> without src in index.html:');
  inlineMatches.forEach(tag => console.error(tag));
  process.exit(1);
} else {
  console.log('Strict CSP inline script check: PASS (Zero inline <script> without src)');
}

console.log('\n=== Step 5: Validating ui.esc() HTML Escaping ===');
const vm = require('vm');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(baseDir, 'js/ui.js'), 'utf8'), sandbox);

const esc = sandbox.window.ui.esc;
if (typeof esc !== 'function') {
  console.error('FAIL: ui.esc is not a function');
  process.exit(1);
}
const testStr = '<script>alert("xss" & \'test\')</script>';
const escaped = esc(testStr);
const expected = '&lt;script&gt;alert(&quot;xss&quot; &amp; &#39;test&#39;)&lt;/script&gt;';
if (escaped !== expected) {
  console.error(`FAIL: ui.esc mismatch.\nExpected: ${expected}\nGot:      ${escaped}`);
  process.exit(1);
}
console.log('ui.esc() HTML escaping: PASS');

console.log('\nALL FRONTEND SHELL VERIFICATIONS PASSED ✓');
