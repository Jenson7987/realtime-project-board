export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Get the backend URL for socket connections (without /api)
export const BACKEND_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:3001'; 