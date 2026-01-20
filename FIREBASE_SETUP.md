# Firebase Setup Guide

This guide will help you set up Firebase Authentication for the MindCare application.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter project name (e.g., "MindCare")
   - Enable/disable Google Analytics (optional)
   - Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project, go to **Authentication** in the left sidebar
2. Click **Get Started**
3. Click on **Sign-in method** tab
4. Click on **Email/Password**
5. Enable **Email/Password** authentication
6. Click **Save**

## Step 3: Get Firebase Configuration

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Select **Project settings**
3. Scroll down to **Your apps** section
4. If you don't have a web app yet:
   - Click the **Web icon** `</>`
   - Register app with a nickname (e.g., "MindCare Web")
   - Click **Register app**
5. Copy the Firebase configuration object

## Step 4: Configure Environment Variables

1. Create a `.env` file in the `frontend` directory:
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. Edit `.env` and add your Firebase credentials:
   ```env
   REACT_APP_FIREBASE_API_KEY=your-api-key-here
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
   REACT_APP_FIREBASE_APP_ID=your-app-id
   ```

## Step 5: (Optional) Set up Firestore Database

If you want to store additional user data:

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Select a location for your database
5. Click **Enable**

### Firestore Security Rules (for production)

Update your Firestore security rules to protect user data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Step 6: Test the Setup

1. Restart your React development server:
   ```bash
   npm start
   ```

2. Try registering a new user:
   - Go to http://localhost:3000/register
   - Fill in the registration form
   - Check Firebase Console > Authentication > Users to see the new user

3. Try logging in:
   - Go to http://localhost:3000/login
   - Use the credentials you just created
   - You should be logged in successfully

## Verification Checklist

- [ ] Firebase project created
- [ ] Email/Password authentication enabled
- [ ] Firebase config added to `.env` file
- [ ] Environment variables loaded (check browser console)
- [ ] Can register new users
- [ ] Can log in with registered users
- [ ] Users appear in Firebase Console > Authentication

## Troubleshooting

### "Firebase is not initialized" error
- Check that your `.env` file exists in the `frontend` directory
- Verify all environment variables are set correctly
- Restart the development server after changing `.env`

### "Email already in use" when registering
- The email is already registered in Firebase
- Try logging in instead, or use a different email

### Authentication not working
- Check browser console for errors
- Verify Firebase API key is correct
- Ensure Email/Password is enabled in Firebase Console
- Check that your domain is authorized in Firebase Console

### Users not appearing in Firebase
- Check Firebase Console > Authentication > Users
- Verify the authentication method is enabled
- Check browser console for any errors

## Security Notes

⚠️ **Important**: Never commit your `.env` file to version control!

- The `.env` file is already in `.gitignore`
- Firebase API keys are safe to expose in client-side code (they're public)
- However, you should still restrict API keys in Firebase Console:
  - Go to **Authentication** > **Settings** > **Authorized domains**
  - Only add your production domain

## Next Steps

After setting up Firebase:

1. **Backend Integration**: Update Django backend to sync with Firebase users
2. **User Profiles**: Create user profile pages
3. **Password Reset**: Implement password reset functionality
4. **Email Verification**: Add email verification on registration

## Support

If you encounter issues:
1. Check the browser console for detailed error messages
2. Verify all Firebase settings are correct
3. Ensure you've restarted the development server after changing `.env`




