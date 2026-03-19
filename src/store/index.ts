import { create } from 'zustand';

export type Theme = 'dark' | 'light' | 'system';

interface AppState {
  sidebarOpen: boolean;
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  initTheme: (savedTheme?: string | null) => void;
}

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyTheme(resolved: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', resolved);
}

export const useAppStore = create<AppState>((set, get) => ({
  sidebarOpen: true,
  theme: 'dark',
  resolvedTheme: 'dark',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setTheme: (theme) => {
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    set({ theme, resolvedTheme: resolved });
  },

  initTheme: (savedTheme) => {
    const theme = (savedTheme as Theme) ?? 'dark';
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    set({ theme, resolvedTheme: resolved });

    // Listen for system theme changes
    if (theme === 'system') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const current = get();
        if (current.theme === 'system') {
          const newResolved = e.matches ? 'dark' : 'light';
          applyTheme(newResolved);
          set({ resolvedTheme: newResolved });
        }
      });
    }
  },
}));
