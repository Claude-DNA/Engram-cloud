import { useAppStore } from '../store';
import type { Theme } from '../store';
import { settingsRepository } from '../repositories';

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'system', label: 'System', icon: '💻' },
];

export default function Settings() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const handleThemeChange = async (newTheme: Theme) => {
    setTheme(newTheme);
    try {
      await settingsRepository.set('theme', newTheme);
    } catch (err) {
      console.error('Failed to persist theme:', err);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-lg font-semibold text-text-primary mb-6">⚙️ Settings</h2>

      {/* Theme */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-text-primary text-sm font-medium mb-3">Appearance</h3>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleThemeChange(opt.value)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm border transition-all ${
                theme === opt.value
                  ? 'bg-accent-gold/10 border-accent-gold text-accent-gold'
                  : 'border-border text-text-secondary hover:text-text-primary hover:border-accent-gold/30'
              }`}
            >
              <span className="block text-lg mb-1">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* App info */}
      <div className="mt-6 text-text-secondary/50 text-xs space-y-1">
        <p>Engram Cloud v0.1.0</p>
        <p>Data stored locally via SQLite</p>
      </div>
    </div>
  );
}
