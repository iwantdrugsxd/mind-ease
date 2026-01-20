import React, { createContext, useContext, useState, useEffect } from 'react';
import { useFirebase } from './FirebaseContext';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { auth, user: firebaseUser, db } = useFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (firebaseUser) {
      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || ''
      });
    } else {
      setUser(null);
    }
    setLoading(false);
  }, [firebaseUser]);

  const login = async (email: string, password: string) => {
    try {
      if (!auth) {
        throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
      }

      // Check if Firebase is properly configured (not using demo keys)
      const isFirebaseConfigured = auth.app.options.apiKey && 
                                   auth.app.options.apiKey !== 'demo-key' &&
                                   auth.app.options.projectId !== 'demo-project';

      if (!isFirebaseConfigured) {
        console.warn('Firebase is using demo configuration. Please set up your Firebase credentials.');
        // Fallback to mock for development
        setUser({
          id: 'demo-user-id',
          email: email,
          name: email.split('@')[0]
        });
        return;
      }

      // Use real Firebase authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful:', userCredential.user.uid);
      
      // Create patient card in backend
      try {
        const api = (await import('../utils/api')).default;
        await api.post('/screening/patients/', {
          firebase_uid: userCredential.user.uid
        });
        console.log('Patient card created/updated on login');
      } catch (patientError: any) {
        console.warn('Failed to create patient card (may already exist):', patientError);
        // Don't fail login if patient creation fails
      }
      
      // The user state will be updated automatically via onAuthStateChanged in FirebaseContext
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to sign in. Please check your credentials.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      if (!auth) {
        throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
      }

      // Check if Firebase is properly configured (not using demo keys)
      const isFirebaseConfigured = auth.app.options.apiKey && 
                                   auth.app.options.apiKey !== 'demo-key' &&
                                   auth.app.options.projectId !== 'demo-project';

      if (!isFirebaseConfigured) {
        console.warn('Firebase is using demo configuration. Please set up your Firebase credentials.');
        // Fallback to mock for development
        setUser({
          id: 'demo-user-id',
          email: email,
          name: name
        });
        return;
      }

      // Validate password length
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      // Create user in Firebase
      console.log('Creating Firebase user with email:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('User created successfully:', userCredential.user.uid);

      // Update the user's display name
      const firebaseUser = userCredential.user;
      if (firebaseUser && updateProfile) {
        await updateProfile(firebaseUser, {
          displayName: name
        });
        console.log('Display name updated:', name);
      }

      // Optionally, store additional user data in Firestore
      if (db) {
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            email: email,
            name: name,
            createdAt: new Date().toISOString(),
            uid: firebaseUser.uid
          });
          console.log('User data saved to Firestore');
        } catch (firestoreError) {
          console.warn('Failed to save user data to Firestore:', firestoreError);
          // Don't fail registration if Firestore save fails
        }
      }

      // Create patient card in backend
      try {
        const api = (await import('../utils/api')).default;
        await api.post('/screening/patients/', {
          firebase_uid: firebaseUser.uid
        });
        console.log('Patient card created on registration');
      } catch (patientError: any) {
        console.warn('Failed to create patient card (may already exist):', patientError);
        // Don't fail registration if patient creation fails
      }

      // The user state will be updated automatically via onAuthStateChanged in FirebaseContext
      console.log('Registration completed successfully');
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please enter a valid email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password accounts are not enabled. Please contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      if (!auth) {
        // Mock logout for development
        setUser(null);
        return;
      }

      // Check if Firebase is properly configured
      const isFirebaseConfigured = auth.app.options.apiKey && 
                                   auth.app.options.apiKey !== 'demo-key' &&
                                   auth.app.options.projectId !== 'demo-project';

      if (isFirebaseConfigured && auth.currentUser) {
        await signOut(auth);
        console.log('User signed out successfully');
      } else {
        // Mock logout for development
        setUser(null);
      }
    } catch (error: any) {
      console.error('Logout error:', error);
      // Even if signOut fails, clear local user state
      setUser(null);
      throw new Error('Failed to sign out. Please try again.');
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
