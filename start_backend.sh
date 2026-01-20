#!/bin/bash

echo "🚀 Starting MindEase Backend Server..."
echo ""

# Navigate to backend directory
cd mental_health_backend

# Activate virtual environment
source ../backend_env/bin/activate

# Run migrations to ensure database is up to date
echo "📊 Running database migrations..."
python manage.py migrate

echo ""
echo "✅ Starting Django server on http://localhost:8000"
echo "📝 Keep this terminal open while using the app"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Start the server
python manage.py runserver 0.0.0.0:8000



