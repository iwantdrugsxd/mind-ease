/**
 * Django API (must be deployed). Default matches render.yaml → service "mindcare-django-api".
 *
 * Deploy once: https://dashboard.render.com → New → Blueprint → connect repo → apply render.yaml.
 * Then set FIREBASE_CREDENTIALS_JSON on that service (Firebase Console → Project settings → Service accounts).
 *
 * First request after idle can take 1–2 minutes (Render free tier cold start).
 */
window.__RUNTIME_CONFIG__ = window.__RUNTIME_CONFIG__ || {};
window.__RUNTIME_CONFIG__.API_BASE_URL =
  'https://mindcare-django-api.onrender.com/api';
