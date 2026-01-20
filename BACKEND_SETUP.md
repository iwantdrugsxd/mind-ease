# Backend Server Setup - Quick Start

## The Issue
If you're seeing `ERR_CONNECTION_REFUSED` or `Network Error` when trying to save journal entries or use the chatbot, it means the Django backend server is not running.

## Quick Fix

### Step 1: Start the Backend Server

Open a new terminal and run:

```bash
cd /Users/vishnu/amogh-major/mental_health_backend
source ../backend_env/bin/activate
python manage.py runserver
```

You should see:
```
Starting development server at http://127.0.0.1:8000/
```

### Step 2: Keep It Running
**Important**: Keep this terminal window open and the server running while using the app.

### Step 3: Test the Connection
1. Open your browser to the deployed app: https://mindcare-mental-health-a1a1f.web.app
2. Try saving a journal entry
3. It should now work!

## Alternative: Use the Start Script

You can also use the provided start script:

```bash
cd /Users/vishnu/amogh-major
./start_app.sh
```

This will start both frontend and backend servers.

## For Production Deployment

If you want to deploy the backend to production (so it's always accessible), you'll need to:

1. **Deploy Django backend** to a service like:
   - Heroku
   - Railway
   - DigitalOcean
   - AWS
   - Google Cloud Platform

2. **Update the API URL** in Firebase Hosting environment variables:
   - Go to Firebase Console → Hosting → Environment Variables
   - Set `REACT_APP_API_BASE_URL` to your production backend URL
   - Rebuild and redeploy

## Troubleshooting

### Port 8000 Already in Use
If you get an error that port 8000 is already in use:

```bash
# Find and kill the process
lsof -ti:8000 | xargs kill -9

# Or use a different port
python manage.py runserver 8001
```

Then update `frontend/src/utils/api.ts` to use port 8001.

### Database Issues
If you get database errors:

```bash
cd mental_health_backend
source ../backend_env/bin/activate
python manage.py migrate
```

### Missing Dependencies
If you get import errors:

```bash
cd mental_health_backend
source ../backend_env/bin/activate
pip install -r requirements.txt
```

## Current Setup

- **Frontend**: Deployed on Firebase Hosting (https://mindcare-mental-health-a1a1f.web.app)
- **Backend**: Running locally on http://localhost:8000
- **Connection**: Frontend connects to localhost:8000 (works when backend is running)

## Next Steps

For a fully production-ready setup, consider deploying the backend to a cloud service so it's always accessible.



