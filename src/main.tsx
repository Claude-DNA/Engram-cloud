// Global error handler to surface import/module errors
window.addEventListener('error', (e) => {
  const root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    root.innerHTML = '<pre style="color:red;padding:20px">' +
      (e.error ? e.error.stack : e.message) + '</pre>';
  }
});
window.addEventListener('unhandledrejection', (e) => {
  const root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    root.innerHTML = '<pre style="color:red;padding:20px">Unhandled: ' +
      (e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : 'unknown') + '</pre>';
  }
});

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
