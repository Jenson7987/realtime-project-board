import React, { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState<string>('Loading...');

  useEffect(() => {
    fetch('/health')
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(() => setStatus('Failed to connect to backend'));
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Board App</h1>
      <p>Status: {status}</p>
    </div>
  );
}

export default App;
