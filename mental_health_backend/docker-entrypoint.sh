#!/bin/sh
set -e
# screening.E001 requires onboarding tables; checks run before migrate by default, so migrate would never run on a fresh DB.
python manage.py migrate --noinput --skip-checks

# Free tier: 1 worker + threads saves RAM; --preload loads Django once before fork (fewer duplicate imports).
WORKERS="${WEB_CONCURRENCY:-1}"
exec gunicorn mental_health_backend.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "$WORKERS" \
    --threads 4 \
    --timeout 120 \
    --preload
