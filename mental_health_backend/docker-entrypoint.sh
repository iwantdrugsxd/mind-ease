#!/bin/sh
set -e
python manage.py migrate --noinput
exec gunicorn mental_health_backend.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers 2 \
    --threads 4 \
    --timeout 120
