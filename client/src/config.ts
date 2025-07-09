export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Get the backend URL for socket connections (without /api)
// In production, this should be the same as API_BASE_URL but without /api
export const BACKEND_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:3001';

// Log the URLs for debugging
console.log('Config loaded:', {
  API_BASE_URL,
  BACKEND_URL,
  NODE_ENV: process.env.NODE_ENV,
  REACT_APP_API_URL: process.env.REACT_APP_API_URL
}); 