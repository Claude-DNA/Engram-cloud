import { useAppStore } from '../store';

export default function Titlebar() {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <div
      data-tauri-drag-region
      className="h-10 w-full bg-surface border-b border-border flex items-center px-3 shrink-0"
    >
      {/* macOS traffic lights occupy ~70px on left */}
      <div className="w-[70px] shrink-0" />

      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="text-text-secondary hover:text-text-primary transition-colors p-1 rounded hover:bg-background/50"
        aria-label="Toggle sidebar"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M3 4.5h12M3 9h12M3 13.5h12" />
        </svg>
      </button>

      {/* Title */}
      <span
        data-tauri-drag-region
        className="text-text-secondary text-xs font-medium ml-3 select-none"
      >
        Engram Cloud
      </span>

      {/* Spacer — draggable */}
      <div data-tauri-drag-region className="flex-1" />
    </div>
  );
}
