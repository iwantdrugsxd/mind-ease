/**
 * Public Django API for Firebase Hosting (must be https:// on the internet).
 * Default matches render.yaml service name "mindcare-django-api".
 * Deploy backend: https://dashboard.render.com → New → Blueprint → connect this repo (or Web Service with mental_health_backend/Dockerfile).
 * If your Render URL differs, change the string below, then: cd frontend && npm run build && firebase deploy --only hosting
 *
 * Blaze plan alternative: same-origin /api via Cloud Functions proxy (see git history or Firebase docs).
 */
window.__RUNTIME_CONFIG__ = window.__RUNTIME_CONFIG__ || {};
window.__RUNTIME_CONFIG__.API_BASE_URL =
  'https://mindcare-django-api.onrender.com/api';
