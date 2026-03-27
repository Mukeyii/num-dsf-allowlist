/**
 * main.tsx – Minimal React mount (placeholder for Phase 4)
 */
import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', padding: '2rem', color: '#181c20' }}>
      <h1>DSF Allow List Management</h1>
      <p>Phase 1 – Fundament loaded. Frontend will be built in Phase 4.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
