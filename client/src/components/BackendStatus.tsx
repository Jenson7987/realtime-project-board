import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const BackendStatus: React.FC = () => {
  const { isBackendOnline, checkBackendStatus } = useAuth();

  if (isBackendOnline) {
    return null; // Don't show anything when backend is online
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
      <span className="text-sm font-medium">Backend waking up...</span>
      <button
        onClick={checkBackendStatus}
        className="text-xs underline hover:no-underline"
      >
        Retry
      </button>
    </div>
  );
};

export default BackendStatus; 