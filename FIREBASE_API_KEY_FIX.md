# Firebase API Key Error Fix

## Problem
You're seeing: `Firebase: Error (auth/api-key-not-valid.-please-pass-a-valid-api-key.)`

## Solution

The API key in your `.env` file is correct, but Firebase might have API key restrictions enabled.

### Steps to Fix:

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/project/mindcare-mental-health-a1a1f/settings/general

2. **Check API Key Restrictions**
   - Scroll down to "Web API Key" section
   - Click on the API key (or go to Google Cloud Console > APIs & Services > Credentials)

3. **Remove or Adjust Restrictions**
   - For **development**: Set "Application restrictions" to **"None"**
   - OR add `localhost` to allowed HTTP referrers:
     - `localhost:3000/*`
     - `127.0.0.1:3000/*`
     - `http://localhost:3000/*`

4. **Save Changes**
   - Click "Save" and wait a few seconds for changes to propagate

5. **Restart Your App**
   - Stop the server (Ctrl+C)
   - Run `./start_app.sh` again
   - Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)

## Alternative: Check API Key Restrictions in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials?project=mindcare-mental-health-a1a1f
2. Find your API key
3. Click on it
4. Under "API restrictions", make sure:
   - Either "Don't restrict key" is selected
   - OR "Restrict key" includes the necessary APIs (Firebase Authentication, etc.)
5. Under "Application restrictions":
   - For development: Select "None"
   - OR add HTTP referrers: `localhost:3000/*`

## Verify Fix

After making changes:
1. Wait 1-2 minutes for changes to propagate
2. Refresh your browser (hard refresh: Ctrl+Shift+R)
3. Try logging in again
4. Check browser console for "✅ Firebase initialized successfully"




