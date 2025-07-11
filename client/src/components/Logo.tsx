import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center space-x-2 ${className}`}>
    <img src="/logo.svg" alt="Project Board Logo" className="h-10 w-auto" />
    <span className="text-2xl font-bold text-blue-700">Project Board</span>
  </div>
);

export default Logo; 