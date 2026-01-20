# Quick Fix: Journal Entry Not Saving

## The Problem
The journal entry is not saving because the **Django backend server is not running**.

## The Solution (2 Steps)

### Step 1: Start the Backend Server

Open a **new terminal window** and run:

```bash
cd /Users/vishnu/amogh-major
./start_backend.sh
```

**OR** manually:

```bash
cd /Users/vishnu/amogh-major/mental_health_backend
source ../backend_env/bin/activate
python manage.py runserver 0.0.0.0:8000
```

You should see:
```
Starting development server at http://0.0.0.0:8000/
Quit the server with CONTROL-C.
```

### Step 2: Keep It Running
**IMPORTANT**: Keep this terminal window open and the server running while using the app.

### Step 3: Test
1. Go to your deployed app: https://mindcare-mental-health-a1a1f.web.app/selfcare
2. Select a mood
3. Write in the journal
4. Click "Save Entry"
5. It should now save successfully! ✅

## Why This Happens

- Your **frontend** is deployed on Firebase Hosting (always accessible)
- Your **backend** needs to run locally on your computer
- When you access the deployed site, it tries to connect to `localhost:8000` on YOUR computer
- If the backend isn't running, you get `ERR_CONNECTION_REFUSED`

## Verification

After starting the backend, you can verify it's working:

1. Open browser: http://localhost:8000/api/selfcare/mood-entries/
2. You should see an empty list `[]` (not an error)
3. This confirms the backend is running and accessible

## Troubleshooting

### Port 8000 Already in Use
```bash
# Find what's using port 8000
lsof -ti:8000

# Kill it
lsof -ti:8000 | xargs kill -9

# Then start the server again
```

### Database Errors
```bash
cd mental_health_backend
source ../backend_env/bin/activate
python manage.py migrate
```

### Still Not Working?
1. Check the backend terminal for error messages
2. Check browser console (F12) for detailed errors
3. Make sure you're accessing from the same computer where the backend is running

## For Production (Future)

To make the backend always accessible (not just when running locally), you'll need to deploy it to:
- Heroku
- Railway
- DigitalOcean
- AWS
- Google Cloud Platform

Then update the API URL in Firebase Hosting environment variables.



