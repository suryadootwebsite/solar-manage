/**
 * config.js — Frontend Environment Configuration.
 *
 * DO NOT hardcode secrets or private keys in this file.
 * Replace API_BASE_URL with your deployed Google Apps Script Web App URL.
 *
 * Doc ref: Doc 06 §12 (Frontend Technical Notes)
 */

window.APP_CONFIG = {
  // Replace with the deployed Google Apps Script Web App URL from Step S02
  API_BASE_URL: 'https://script.google.com/macros/s/AKfycbzBehcNVs9lY-1WlFEu8rpAZJYiZFu55D7MaSlsyX-2PYYbI_GlMUA2KnfCxmt0F19liA/exec',

  // API Version
  API_VERSION: 1,

  // App Metadata
  APP_NAME: 'Solar Management System',
  APP_VERSION: '1.0.0',

  // Localization
  DEFAULT_LANG: 'en',

  // Network timeouts & retries (Doc 03 F-30)
  API_TIMEOUT_MS: 45000,
  MAX_RETRIES: 2,
  RETRY_BACKOFF_MS: [1000, 3000]
};
