# Firebase Quick Start Checklist

## 🚀 5-Minute Setup

### Step 1: Create Project (2 min)
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name: `mindcare-mental-health`
4. Skip Analytics (or enable)
5. Click "Create project"

### Step 2: Register Web App (1 min)
1. Click Web icon (`</>`) or "Add app" → "Web"
2. Nickname: `mindcare-web`
3. Click "Register app"
4. **Copy the `firebaseConfig` values** (keep this tab open!)

### Step 3: Enable Auth (30 sec)
1. Left sidebar → "Authentication"
2. Click "Get started"
3. "Sign-in method" tab → "Email/Password"
4. Toggle "Enable" → Save

### Step 4: Configure API Key (1 min)
1. Firebase Console → ⚙️ Settings → Project settings
2. Scroll to "Web API Key" → Click it
3. "Application restrictions" → **"None"** (for dev)
4. "API restrictions" → **"Don't restrict key"** (for dev)
5. Click "Save"

### Step 5: Create .env File (30 sec)
```bash
cd frontend
cat > .env << 'EOF'
REACT_APP_FIREBASE_API_KEY=PASTE_YOUR_API_KEY_HERE
REACT_APP_FIREBASE_AUTH_DOMAIN=PASTE_YOUR_AUTH_DOMAIN_HERE
REACT_APP_FIREBASE_PROJECT_ID=PASTE_YOUR_PROJECT_ID_HERE
REACT_APP_FIREBASE_STORAGE_BUCKET=PASTE_YOUR_STORAGE_BUCKET_HERE
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=PASTE_YOUR_SENDER_ID_HERE
REACT_APP_FIREBASE_APP_ID=PASTE_YOUR_APP_ID_HERE
REACT_APP_API_BASE_URL=http://localhost:8000/api
EOF
```

**Replace ALL `PASTE_YOUR_*_HERE` with actual values from Step 2**

### Step 6: Restart Server
```bash
cd ..
# Stop current server (Ctrl+C)
./start_app.sh
```

### Step 7: Verify
- Open http://localhost:3000
- Open browser console (F12)
- Look for: `✅ Firebase initialized successfully`
- Try registering a user at /register

---

## 📋 Quick Reference

**Where to find values:**
- Firebase Console → ⚙️ Settings → Project settings → Your apps → [your app]

**If you see errors:**
- Check `.env` file has correct values
- Restart React server
- Check API key restrictions (Step 4)
- Hard refresh browser (Ctrl+Shift+R)

---

**Full detailed guide:** See `FIREBASE_COMPLETE_SETUP_GUIDE.md`

