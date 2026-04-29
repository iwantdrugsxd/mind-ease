import axios from 'axios';
import { getAuth } from 'firebase/auth';

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: { API_BASE_URL?: string };
  }
}

const DEFAULT_LOCAL_API = 'http://localhost:8000/api';

function normalizeApiRoot(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  // Same-origin relative API (Firebase proxy): keep leading slash
  if (trimmed === '/api' || trimmed.startsWith('/api/')) {
    return trimmed;
  }
  return trimmed;
}

function looksLikeLocalhostApi(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

// Hosted Firebase (and similar) cannot reach your laptop's localhost — need a public API URL.
const getApiBaseUrl = (): string => {
  const runtimeRaw =
    typeof window !== 'undefined'
      ? window.__RUNTIME_CONFIG__?.API_BASE_URL?.trim()
      : '';
  if (runtimeRaw) {
    return normalizeApiRoot(runtimeRaw);
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';

  const envDev = process.env.REACT_APP_API_BASE_URL?.trim();
  const envProd = process.env.REACT_APP_API_BASE_URL_PRODUCTION?.trim();

  if (isLocalHost) {
    return normalizeApiRoot(envDev || DEFAULT_LOCAL_API);
  }

  if (envProd && !looksLikeLocalhostApi(envProd)) {
    return normalizeApiRoot(envProd);
  }
  if (envDev && !looksLikeLocalhostApi(envDev)) {
    return normalizeApiRoot(envDev);
  }

  // Hosted Firebase: never fall back to visitor localhost (runtime-config.js should set a public URL)
  const isHostedFirebase =
    /\.web\.app$/i.test(host) || /\.firebaseapp\.com$/i.test(host);
  if (isHostedFirebase) {
    const fallback =
      process.env.REACT_APP_API_BASE_URL_PRODUCTION?.trim() ||
      'https://mindcare-django-api.onrender.com/api';
    if (!looksLikeLocalhostApi(fallback)) {
      return normalizeApiRoot(fallback);
    }
  }

  return normalizeApiRoot(DEFAULT_LOCAL_API);
};

export const API_BASE_URL = getApiBaseUrl();

export function isHostedAppCallingLocalApi(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  const isLocalHost = h === 'localhost' || h === '127.0.0.1';
  if (isLocalHost) return false;
  return looksLikeLocalhostApi(API_BASE_URL);
}

export async function getApiAuthToken(): Promise<string | null> {
  let token: string | null = null;
  try {
    const auth = getAuth();
    if (typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
    }
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken();
    } else {
      // Do not reuse a stale token from localStorage when Firebase has already
      // restored to "signed out" or has no current user for this tab yet.
      localStorage.removeItem('authToken');
    }
  } catch {
    // fall through to localStorage
  }
  if (!token && localStorage.getItem('authToken')) {
    token = localStorage.getItem('authToken');
  }
  return token;
}

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token if available
api.interceptors.request.use(
  (async (config: any) => {
    const token = await getApiAuthToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Let the browser set multipart boundary for file uploads.
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
    }
    return config;
  }) as any,
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle connection errors (includes many CORS failures surfacing as "Network Error")
    const isNetworkFail =
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('timeout') ||
      error.message?.includes('ERR_CONNECTION_REFUSED');

    if (isNetworkFail) {
      const isProduction = window.location.hostname !== 'localhost' && 
                           window.location.hostname !== '127.0.0.1';
      
      if (isProduction) {
        console.error('Backend server is not accessible. Please ensure the backend is running and accessible.');
        const renderHint =
          'If the API host is on Render but you still see this, the service may not exist yet (Render returns "no-server" until you deploy). Open https://dashboard.render.com → New → Blueprint, connect this repo, apply render.yaml, then set environment variable FIREBASE_CREDENTIALS_JSON to your Firebase service account JSON (same project as the app). After the first successful deploy, wait up to 2 minutes for a cold start and try again.';
        const hint = isHostedAppCallingLocalApi()
          ? 'Hosted apps cannot use http://localhost:8000. Set API_BASE_URL in frontend/public/runtime-config.js to your public https://…/api, rebuild, and redeploy Firebase Hosting.'
          : `${renderHint} CORS is configured for all *.web.app and *.firebaseapp.com origins.`;
        return Promise.reject({
          ...error,
          message: `Cannot reach the API (${API_BASE_URL}). ${hint}`,
          isConnectionError: true
        });
      } else {
        console.error('Cannot connect to backend. Make sure the Django server is running on http://localhost:8000');
        return Promise.reject({
          ...error,
          message: 'Cannot connect to backend server. Please start the Django backend: cd mental_health_backend && python manage.py runserver',
          isConnectionError: true
        });
      }
    }
    
    if (error.response?.status === 401) {
      // Wait for Firebase to restore session on reload before treating 401 as logged out.
      return (async () => {
        let hasFirebaseUser = false;
        try {
          const auth = getAuth();
          if (typeof auth.authStateReady === 'function') {
            await auth.authStateReady();
          }
          hasFirebaseUser = !!auth.currentUser;
        } catch {
          hasFirebaseUser = false;
        }

        if (!hasFirebaseUser) {
          localStorage.removeItem('authToken');
          const path = window.location.pathname || '';
          window.location.href = path.startsWith('/clinician') ? '/clinician/login' : '/login';
        }
        return Promise.reject(error);
      })();
    }
    return Promise.reject(error);
  }
);

export default api;
