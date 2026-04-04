#!/bin/sh
set -e
# screening.E001 requires onboarding tables; checks run before migrate by default, so migrate would never run on a fresh DB.
python manage.py migrate --noinput --skip-checks

# No --preload: avoids inheriting DB connections into forked workers (breaks PostgreSQL on first requests).
WORKERS="${WEB_CONCURRENCY:-1}"
exec gunicorn mental_health_backend.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "$WORKERS" \
    --threads 4 \
    --timeout 120
