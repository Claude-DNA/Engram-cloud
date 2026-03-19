import { useState, useEffect } from 'react';
import ProfileSettings from '../views/settings/ProfileSettings';
import SecuritySettings from '../views/settings/SecuritySettings';
import AISettings from '../views/settings/AISettings';
import ImportSettings from '../views/settings/ImportSettings';
import ExportSettings from '../views/settings/ExportSettings';
import AboutSettings from '../views/settings/AboutSettings';
import MacOSSettings from '../views/settings/MacOSSettings';

type Section = 'profile' | 'security' | 'ai' | 'import' | 'export' | 'about' | 'macos';

const BASE_SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'security', label: 'Security', icon: '🔐' },
  { id: 'ai', label: 'AI', icon: '✨' },
  { id: 'import', label: 'Import', icon: '📥' },
  { id: 'export', label: 'Export', icon: '📤' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
];

const MACOS_SECTION: { id: Section; label: string; icon: string } = {
  id: 'macos',
  label: 'macOS',
  icon: '',
};

export default function Settings() {
  const [activeSection, setActiveSection] = useState<Section>('profile');
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.userAgent.includes('Mac'));
  }, []);

  const sections = isMac ? [...BASE_SECTIONS, MACOS_SECTION] : BASE_SECTIONS;

  const renderContent = () => {
    switch (activeSection) {
      case 'profile': return <ProfileSettings />;
      case 'security': return <SecuritySettings />;
      case 'ai': return <AISettings />;
      case 'import': return <ImportSettings />;
      case 'export': return <ExportSettings />;
      case 'about': return <AboutSettings />;
      case 'macos': return <MacOSSettings />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <nav className="w-44 shrink-0 border-r border-slate-700/50 flex flex-col gap-0.5 p-2 overflow-y-auto">
        <p className="text-xs text-slate-500 uppercase tracking-wide px-3 py-2 font-medium">Settings</p>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left w-full ${
              activeSection === s.id
                ? 'bg-indigo-600/30 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            {s.icon && <span>{s.icon}</span>}
            {s.label}
          </button>
        ))}
      </nav>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto p-6 max-w-xl">
        {renderContent()}
      </main>
    </div>
  );
}
