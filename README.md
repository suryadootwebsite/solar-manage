# Solar Management System — Frontend (`solar-manage`)

Mobile-first Progressive Web App (PWA) frontend for the Solar Management System.
Hosted as a static single-page application (SPA) on GitHub Pages.

---

## Architecture Overview

- **Stack**: Vanilla HTML5, CSS3, JavaScript (ES6+), zero external runtime dependencies.
- **Hosting**: GitHub Pages (via `.github/workflows/deploy.yml`).
- **PWA**: Web App Manifest (`manifest.json`) + Service Worker (`service-worker.js`) for app shell caching.
- **Routing**: Client-side hash routing (`#/`, `#/ping`, `#/sites`, etc.) to support static GitHub Pages hosting without server rewrites.
- **Internationalization**: Full bilingual support (Hindi + English) via `js/i18n.js` with instant language switching.
- **Backend API**: Connects to the private Google Apps Script Web App backend via `js/api.js`.

---

## Configuration

To connect this frontend to your deployed Google Apps Script backend:
1. Open `js/config.js`.
2. Update `API_BASE_URL` with your deployed Google Apps Script Web App URL:
   ```javascript
   window.APP_CONFIG = {
     API_BASE_URL: 'https://script.google.com/macros/s/YOUR_ACTUAL_SCRIPT_ID/exec',
     ...
   };
   ```
3. Commit and push to `main`. GitHub Pages will auto-deploy.

---

## Local Development

Run any static HTTP server in the repository root:

```bash
# Python
python -m http.server 8080

# Node.js npx
npx serve .
```

Open `http://localhost:8080` in your browser or phone.
