import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* macOS overlay titlebar spacer */}
      <div data-tauri-drag-region className="h-8 w-full bg-surface border-b border-border flex items-center px-4">
        <span className="text-text-secondary text-xs font-medium ml-20">Engram Cloud</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
