import { Outlet } from 'react-router-dom';
import Titlebar from './Titlebar';
import Sidebar from './Sidebar';
import Toast from './Toast';

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Skip to content — visible only on focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-accent-gold focus:text-background focus:px-3 focus:py-1.5 focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-auto" role="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  );
}
