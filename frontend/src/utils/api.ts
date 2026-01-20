import axios from 'axios';

// Determine API base URL based on environment
const getApiBaseUrl = () => {
  // If explicitly set in environment, use that
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }
  
  // In production (deployed), try to use a production backend URL
  // For now, default to localhost for development
  // TODO: Replace with your production backend URL when deployed
  const isProduction = window.location.hostname !== 'localhost' && 
                       window.location.hostname !== '127.0.0.1';
  
  if (isProduction) {
    // If you have a production backend, set it here or via environment variable
    // Example: return 'https://your-backend-domain.com/api';
    // For now, we'll still try localhost but show a helpful error
    console.warn('Production mode detected but no production API URL configured. Using localhost.');
  }
  
  return 'http://localhost:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token if available
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage or Firebase auth
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle connection errors
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
      const isProduction = window.location.hostname !== 'localhost' && 
                           window.location.hostname !== '127.0.0.1';
      
      if (isProduction) {
        console.error('Backend server is not accessible. Please ensure the backend is running and accessible.');
        // Return a more helpful error
        return Promise.reject({
          ...error,
          message: 'Backend server is not running or not accessible. Please start the Django backend server on localhost:8000 or configure a production API URL.',
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
      // Handle unauthorized - clear token and redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

