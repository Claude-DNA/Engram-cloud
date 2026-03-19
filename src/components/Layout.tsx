import { Outlet } from 'react-router-dom';
import Titlebar from './Titlebar';
import Sidebar from './Sidebar';
import Toast from './Toast';

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-background">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto" role="main">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  );
}
