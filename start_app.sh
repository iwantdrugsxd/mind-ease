#!/bin/bash

echo "Starting MindCare Mental Health Platform..."

# Check if virtual environment exists
if [ ! -d "backend_env" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv backend_env
fi

# Activate virtual environment and install dependencies
echo "Activating virtual environment and installing dependencies..."
source backend_env/bin/activate
cd mental_health_backend
pip install -r requirements.txt

# Run migrations
echo "Running database migrations..."
python manage.py migrate

# Start Django backend in background
echo "Starting Django backend server..."
python manage.py runserver 8000 &
BACKEND_PID=$!

# Go back to root and start React frontend
cd ../frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start React frontend
echo "Starting React frontend server..."
npm start &
FRONTEND_PID=$!

echo ""
echo "🚀 MindCare is now running!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo "📊 Admin Panel: http://localhost:8000/admin"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
wait $BACKEND_PID $FRONTEND_PID





