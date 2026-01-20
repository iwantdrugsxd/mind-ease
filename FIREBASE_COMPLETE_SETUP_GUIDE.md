# Complete Firebase Setup Guide for MindCare

This guide will walk you through creating a new Firebase project from scratch and configuring it for the MindCare mental health platform.

## Prerequisites

- A Google account
- Basic familiarity with web browsers

---

## Step 1: Create Firebase Project

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Sign in with your Google account if needed

2. **Create a New Project**
   - Click **"Add project"** or **"Create a project"**
   - Enter project name: `mindcare-mental-health` (or your preferred name)
   - Click **"Continue"**

3. **Configure Google Analytics (Optional)**
   - Choose whether to enable Google Analytics
   - For development, you can skip this
   - Click **"Continue"** or **"Create project"**

4. **Wait for Project Creation**
   - Firebase will create your project (takes 30-60 seconds)
   - Click **"Continue"** when ready

---

## Step 2: Register Your Web App

1. **Add a Web App**
   - In the Firebase Console, click the **Web icon** (`</>`) or **"Add app"** → **"Web"**
   - Or go to: Project Settings → General → Your apps → Add app

2. **Configure App**
   - Enter app nickname: `mindcare-web`
   - **DO NOT** check "Also set up Firebase Hosting" (unless you want hosting)
   - Click **"Register app"**

3. **Copy Configuration**
   - You'll see a code snippet with `firebaseConfig`
   - **Keep this tab open** - you'll need these values
   - The config looks like:
     ```javascript
     const firebaseConfig = {
       apiKey: "AIzaSy...",
       authDomain: "your-project.firebaseapp.com",
       projectId: "your-project-id",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "123456789",
       appId: "1:123456789:web:abc123..."
     };
     ```

4. **Click "Continue to console"**

---

## Step 3: Enable Authentication

1. **Go to Authentication**
   - In the left sidebar, click **"Authentication"**
   - Or go to: https://console.firebase.google.com/project/YOUR-PROJECT-ID/authentication

2. **Get Started**
   - Click **"Get started"** button (first time only)

3. **Enable Email/Password Sign-in**
   - Click on the **"Sign-in method"** tab
   - Find **"Email/Password"** in the list
   - Click on it
   - Toggle **"Enable"** to ON
   - Click **"Save"**

4. **Optional: Enable Email Link (Passwordless)**
   - If you want passwordless login, enable "Email link (passwordless sign-in)"
   - For now, just enable Email/Password

---

## Step 4: Set Up Firestore Database (Optional but Recommended)

1. **Go to Firestore Database**
   - In the left sidebar, click **"Firestore Database"**
   - Or go to: https://console.firebase.google.com/project/YOUR-PROJECT-ID/firestore

2. **Create Database**
   - Click **"Create database"**
   - Choose **"Start in test mode"** (for development)
   - **Security Warning**: This allows read/write for 30 days. For production, set up proper security rules.
   - Select a location (choose closest to you)
   - Click **"Enable"**

3. **Security Rules (Later)**
   - After setup, you can configure security rules in the "Rules" tab
   - For now, test mode is fine for development

---

## Step 5: Get Your Configuration Values

1. **Go to Project Settings**
   - Click the gear icon ⚙️ next to "Project Overview"
   - Select **"Project settings"**
   - Or go to: https://console.firebase.google.com/project/YOUR-PROJECT-ID/settings/general

2. **Find Your Web App Config**
   - Scroll down to **"Your apps"** section
   - Click on your web app (`mindcare-web`)
   - You'll see the configuration values

3. **Copy These Values:**
   - `apiKey` - Web API Key
   - `authDomain` - Auth domain
   - `projectId` - Project ID
   - `storageBucket` - Storage bucket
   - `messagingSenderId` - Messaging sender ID
   - `appId` - App ID
   - `measurementId` - Measurement ID (optional, for Analytics)

---

## Step 6: Configure API Key Restrictions (IMPORTANT)

1. **Go to Google Cloud Console**
   - Click the link next to "Web API Key" in Firebase Project Settings
   - Or go to: https://console.cloud.google.com/apis/credentials?project=YOUR-PROJECT-ID

2. **Click on Your API Key**
   - Find the API key that matches your `apiKey` value
   - Click on it to edit

3. **Application Restrictions**
   - Under **"Application restrictions"**, select:
     - **For Development**: Choose **"None"** (easiest)
     - **OR** Choose **"HTTP referrers (web sites)"** and add:
       - `localhost:3000/*`
       - `127.0.0.1:3000/*`
       - `http://localhost:3000/*`
       - `http://127.0.0.1:3000/*`

4. **API Restrictions**
   - Under **"API restrictions"**, choose:
     - **For Development**: **"Don't restrict key"**
     - **OR** **"Restrict key"** and select:
       - Firebase Authentication API
       - Cloud Firestore API
       - Cloud Storage API (if using storage)

5. **Save Changes**
   - Click **"Save"** at the bottom
   - Wait 1-2 minutes for changes to propagate

---

## Step 7: Create .env File in Frontend

1. **Navigate to Frontend Directory**
   ```bash
   cd frontend
   ```

2. **Create .env File**
   ```bash
   # On Mac/Linux
   touch .env
   
   # Or on Windows
   # Create .env file manually
   ```

3. **Add Your Firebase Configuration**
   Open `.env` and add:
   ```env
   # Firebase Configuration
   # Replace these with YOUR actual values from Step 5
   
   REACT_APP_FIREBASE_API_KEY=your-api-key-here
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
   REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123...
   REACT_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXX
   
   # Backend API URL
   REACT_APP_API_BASE_URL=http://localhost:8000/api
   ```

4. **Example with Real Values:**
   ```env
   REACT_APP_FIREBASE_API_KEY=AIzaSyDty8AJ7ZQseGOqPIGoMwr9qfmFOwEr8Ws
   REACT_APP_FIREBASE_AUTH_DOMAIN=mindcare-mental-health-a1a1f.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=mindcare-mental-health-a1a1f
   REACT_APP_FIREBASE_STORAGE_BUCKET=mindcare-mental-health-a1a1f.firebasestorage.app
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=563373993089
   REACT_APP_FIREBASE_APP_ID=1:563373993089:web:01c197073521a261dc7180
   REACT_APP_FIREBASE_MEASUREMENT_ID=G-70PYVLYE8Y
   
   REACT_APP_API_BASE_URL=http://localhost:8000/api
   ```

5. **Important Notes:**
   - Replace ALL placeholder values with your actual values
   - Do NOT include quotes around the values
   - Do NOT commit `.env` to git (it should be in `.gitignore`)
   - Each variable must be on its own line

---

## Step 8: Verify Configuration

1. **Check .env File**
   ```bash
   cd frontend
   cat .env
   ```
   - Verify all values are correct
   - Make sure there are no typos

2. **Restart Your Development Server**
   ```bash
   # Stop current server (Ctrl+C)
   # Then restart
   cd ..
   ./start_app.sh
   ```

3. **Check Browser Console**
   - Open http://localhost:3000
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for: `✅ Firebase initialized successfully`
   - If you see errors, check the error message

---

## Step 9: Test Authentication

1. **Test Registration**
   - Go to http://localhost:3000/register
   - Enter email and password
   - Click "Register"
   - Check Firebase Console → Authentication → Users
   - You should see the new user

2. **Test Login**
   - Go to http://localhost:3000/login
   - Enter the same email/password
   - Click "Sign in"
   - Should redirect to dashboard

---

## Troubleshooting

### Error: "API key not valid"
**Solution:**
- Check Step 6: API Key Restrictions
- Make sure "localhost" is allowed
- Wait 2-3 minutes after changing restrictions
- Hard refresh browser (Ctrl+Shift+R)

### Error: "Firebase not initialized"
**Solution:**
- Check `.env` file exists in `frontend/` directory
- Verify all environment variables start with `REACT_APP_`
- Restart the React server after creating/editing `.env`
- Check browser console for specific error messages

### Error: "Permission denied" (Firestore)
**Solution:**
- Go to Firestore → Rules
- For development, temporarily use:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if request.time < timestamp.date(2025, 12, 31);
      }
    }
  }
  ```
- ⚠️ **WARNING**: This is only for development! Set proper rules for production.

### Environment Variables Not Loading
**Solution:**
- Environment variables must start with `REACT_APP_`
- Restart React server completely (stop and start again)
- Clear browser cache
- Check for typos in variable names

---

## Quick Reference: Where to Find Values

| Value | Where to Find |
|-------|---------------|
| `apiKey` | Firebase Console → Project Settings → General → Web API Key |
| `authDomain` | Firebase Console → Project Settings → General → `projectId.firebaseapp.com` |
| `projectId` | Firebase Console → Project Settings → General → Project ID |
| `storageBucket` | Firebase Console → Project Settings → General → Storage bucket |
| `messagingSenderId` | Firebase Console → Project Settings → Cloud Messaging → Sender ID |
| `appId` | Firebase Console → Project Settings → Your apps → App ID |
| `measurementId` | Firebase Console → Project Settings → General → Measurement ID (if Analytics enabled) |

---

## Security Best Practices (For Production)

1. **API Key Restrictions**
   - Set HTTP referrer restrictions to your production domain only
   - Restrict API access to only needed APIs

2. **Firestore Security Rules**
   - Replace test mode rules with proper authentication-based rules
   - Example:
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /users/{userId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
     ```

3. **Authentication Settings**
   - Enable email verification if needed
   - Set up password requirements
   - Enable multi-factor authentication for sensitive data

4. **Environment Variables**
   - Never commit `.env` to version control
   - Use different Firebase projects for development and production
   - Use environment-specific `.env` files (`.env.development`, `.env.production`)

---

## Next Steps

After completing setup:

1. ✅ Test user registration
2. ✅ Test user login
3. ✅ Test chatbot functionality
4. ✅ Verify data is being saved to Firestore (if using)
5. ✅ Check that backend can access Firebase (if using Firebase Admin SDK)

---

## Need Help?

- **Firebase Documentation**: https://firebase.google.com/docs
- **Firebase Console**: https://console.firebase.google.com/
- **Google Cloud Console**: https://console.cloud.google.com/
- **Check browser console** for specific error messages
- **Check terminal logs** for backend errors

---

## Summary Checklist

- [ ] Created Firebase project
- [ ] Registered web app
- [ ] Enabled Email/Password authentication
- [ ] Set up Firestore (optional)
- [ ] Copied all configuration values
- [ ] Configured API key restrictions
- [ ] Created `.env` file with correct values
- [ ] Restarted development server
- [ ] Verified Firebase initialization in browser console
- [ ] Tested user registration
- [ ] Tested user login

---

**Congratulations!** Your Firebase project is now configured for MindCare. 🎉




