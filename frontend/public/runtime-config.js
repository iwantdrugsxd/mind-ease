/**
 * Firebase Hosting loads this file as /runtime-config.js (edit the SOURCE file:
 * frontend/public/runtime-config.js — not public/runtime/config.js).
 *
 * Hosted pages cannot call http://localhost:8000 — that is the visitor's computer, not your server.
 *
 * Option A — Quick tunnel (dev/demo):
 *   1) Run Django on 0.0.0.0:8000
 *   2) From repo root: bash scripts/tunnel-django.sh  (needs: brew install cloudflared)
 *   3) Set API_BASE_URL below to https://YOUR-SUBDOMAIN.trycloudflare.com/api
 *   4) cd frontend && npm run build && firebase deploy --only hosting
 *
 * Option B — Real deploy:
 *   Deploy Django (see render.yaml + mental_health_backend/Dockerfile), then set API_BASE_URL
 *   to https://your-service.onrender.com/api and rebuild + redeploy hosting.
 *
 * CORS: mental_health_backend already allows mindcare-mental-health-a1a1f.web.app and .firebaseapp.com.
 */
window.__RUNTIME_CONFIG__ = window.__RUNTIME_CONFIG__ || {};
window.__RUNTIME_CONFIG__.API_BASE_URL = "";
