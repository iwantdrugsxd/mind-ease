import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "demo-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "demo-app-id"
};

// Debug: Log environment variables (only first 10 chars of API key for security)
console.log('Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  hasApiKey: !!process.env.REACT_APP_FIREBASE_API_KEY,
  isDemo: firebaseConfig.apiKey === 'demo-key'
});

let app: any = null;
let auth: any = null;
let db: any = null;

// Check if using demo/placeholder values
const isDemoConfig = firebaseConfig.apiKey === 'demo-key' || 
                     firebaseConfig.apiKey === '' ||
                     firebaseConfig.projectId === 'demo-project';

if (isDemoConfig) {
  console.warn('⚠️ Firebase is using demo configuration. Please set up your Firebase credentials in .env file.');
  console.warn('📝 See FIREBASE_SETUP.md for instructions.');
  // Create mock objects for development
  app = { name: 'mock-app', options: firebaseConfig };
  auth = { 
    app: app,
    currentUser: null,
    onAuthStateChanged: (callback: (user: User | null) => void) => {
      callback(null);
      return () => {};
    }
  };
  db = { name: 'mock-db' };
} else {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('✅ Firebase initialized successfully');
    console.log('✅ Firebase Auth Domain:', firebaseConfig.authDomain);
    console.log('✅ Firebase Project ID:', firebaseConfig.projectId);
  } catch (error: any) {
    console.error('❌ Firebase initialization failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // If it's an API key error, provide helpful guidance
    if (error.code === 'auth/api-key-not-valid' || error.message?.includes('api-key-not-valid')) {
      console.error('⚠️ Firebase API Key Error!');
      console.error('Please check:');
      console.error('1. Go to Firebase Console > Project Settings > General');
      console.error('2. Check "Web API Key" restrictions');
      console.error('3. Make sure "localhost" is allowed in "Application restrictions"');
      console.error('4. Or set restrictions to "None" for development');
    }
    
    // Create mock objects as fallback
    app = { name: 'mock-app', options: firebaseConfig };
    auth = { 
      app: app,
      currentUser: null,
      onAuthStateChanged: (callback: (user: User | null) => void) => {
        callback(null);
        return () => {};
      }
    };
    db = { name: 'mock-db' };
  }
}

interface FirebaseContextType {
  app: typeof app;
  auth: typeof auth;
  db: typeof db;
  user: User | null;
  loading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    app,
    auth,
    db,
    user,
    loading
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
