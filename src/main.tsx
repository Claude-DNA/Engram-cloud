import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppLoader from './components/AppLoader';
import './index.css';
import { runMigrations } from './lib/migrations';
import { useEngramStore } from './stores/engramStore';
import { useAppStore } from './store';
import { productionLoader } from './stores/storeLoader';
import { settingsRepository } from './repositories';
import { loadTransformationsForPerson } from './stores/transformationService';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <AppLoader />
  </React.StrictMode>,
);

async function init() {
  try {
    await runMigrations();

    const savedTheme = await settingsRepository.get('theme');
    useAppStore.getState().initTheme(savedTheme);

    await useEngramStore.getState().hydrate(productionLoader);

    // Load transformations for active person
    const activePersonId = useEngramStore.getState().activePersonId;
    if (activePersonId !== null) {
      await loadTransformationsForPerson(activePersonId);
    }

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
