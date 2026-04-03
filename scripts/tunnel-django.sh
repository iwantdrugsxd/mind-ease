#!/usr/bin/env bash
# Expose local Django (port 8000) to the internet for Firebase Hosting to call.
# Install: brew install cloudflared   (or https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)
#
# 1. Run Django:  cd mental_health_backend && ../backend_env/bin/python manage.py runserver 0.0.0.0:8000
# 2. Run this script; copy the https URL it prints.
# 3. Edit frontend/public/runtime-config.js → API_BASE_URL = "https://YOUR-URL.trycloudflare.com/api"
# 4. cd frontend && npm run build && firebase deploy --only hosting

set -euo pipefail
exec cloudflared tunnel --url "http://127.0.0.1:8000"
