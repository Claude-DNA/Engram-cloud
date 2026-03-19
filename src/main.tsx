import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppLoader from './components/AppLoader';
import './index.css';
import { runMigrations } from './lib/migrations';
import { useEngramStore } from './stores/engramStore';
import { productionLoader } from './stores/storeLoader';

/**
 * Startup sequence (per Cowork Phase 3 guidance):
 * 1. Render loading skeleton immediately (no blank screen)
 * 2. Run migrations (creates/updates tables)
 * 3. Hydrate Zustand store from SQLite (paginated, recent 50)
 * 4. Re-render with full app
 */

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// 1. Show loading skeleton immediately
root.render(
  <React.StrictMode>
    <AppLoader />
  </React.StrictMode>,
);

async function init() {
  try {
    // 2. Run migrations
    await runMigrations();

    // 3. Hydrate store from SQLite
    await useEngramStore.getState().hydrate(productionLoader);

    // 4. Render full app
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>,
    );
  } catch (err) {
    console.error('App initialization failed:', err);
    root.render(
      <React.StrictMode>
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-center max-w-sm">
            <span className="text-4xl block mb-4">⚠️</span>
            <h1 className="text-text-primary font-semibold mb-2">
              Database Error
            </h1>
            <p className="text-text-secondary text-sm mb-4">
              {err instanceof Error ? err.message : 'Failed to initialize the database.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-accent-gold text-background rounded-lg text-sm font-medium hover:bg-accent-gold/90"
            >
              Retry
            </button>
          </div>
        </div>
      </React.StrictMode>,
    );
  }
}

init();
