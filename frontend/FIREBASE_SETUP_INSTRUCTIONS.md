# Quick Firebase Setup Instructions

## The Error You're Seeing

```
Firebase: Error (auth/api-key-not-valid.-please-pass-a-valid-api-key.)
```

This means Firebase is trying to use invalid or demo API keys. You need to set up your Firebase project and add the credentials.

## Quick Setup (5 minutes)

### Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click **"Add project"** or select existing project
3. Enter project name: **"MindCare"** (or any name)
4. Click **"Continue"** → **"Continue"** → **"Create project"**
5. Wait for project to be created, then click **"Continue"**

### Step 2: Enable Authentication

1. In Firebase Console, click **"Authentication"** in left sidebar
2. Click **"Get started"**
3. Click **"Sign-in method"** tab
4. Click **"Email/Password"**
5. Toggle **"Enable"** 
6. Click **"Save"**

### Step 3: Get Your Firebase Config

1. In Firebase Console, click the **gear icon** ⚙️ next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. If you don't have a web app:
   - Click the **Web icon** `</>`
   - Register app name: **"MindCare Web"**
   - Click **"Register app"**
5. You'll see a config object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### Step 4: Create .env File

1. In the `frontend` folder, create a file named `.env`:

```bash
cd frontend
touch .env
```

2. Open `.env` and paste your Firebase config (replace the values):

```env
REACT_APP_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef123456

REACT_APP_API_BASE_URL=http://localhost:8000/api
```

### Step 5: Restart the Server

**Important:** After creating/updating `.env`, you MUST restart the React server:

1. Stop the current server (Ctrl+C)
2. Restart it:
   ```bash
   cd frontend
   npm start
   ```

Or restart both servers:
```bash
./start_app.sh
```

## Verify It's Working

1. Open browser console (F12)
2. Look for: `✅ Firebase initialized successfully`
3. Try registering a new user at http://localhost:3000/register
4. Check Firebase Console > Authentication > Users to see the new user

## Troubleshooting

### Still getting API key error?
- ✅ Make sure `.env` file is in `frontend/` folder (not root)
- ✅ Make sure you restarted the server after creating `.env`
- ✅ Check that all values in `.env` start with `REACT_APP_`
- ✅ Verify no quotes around values in `.env`
- ✅ Check browser console for the actual API key being used

### Can't find Firebase settings?
- Make sure you're logged into Firebase Console
- Make sure you selected the correct project
- Project Settings is under the gear icon ⚙️

### Want to use mock auth for now?
- The app will automatically use mock authentication if Firebase isn't configured
- You can still test all features, but users won't be saved to Firebase

## Need Help?

Check the full setup guide: `FIREBASE_SETUP.md` (in project root)




