import { NavLink, useNavigate } from 'react-router-dom';
import { useEngramStore } from '../stores/engramStore';
import { useAppStore } from '../store';
import type { CloudType } from '../types/engram';
import { VALID_CLOUD_TYPES } from '../types/engram';

const CLOUD_ICONS: Record<CloudType, string> = {
  memory: '🧠',
  knowledge: '📚',
  belief: '✨',
  value: '💎',
  skill: '🛠',
  goal: '🎯',
  reflection: '🪞',
};

const CLOUD_LABELS: Record<CloudType, string> = {
  memory: 'Memories',
  knowledge: 'Knowledge',
  belief: 'Beliefs',
  value: 'Values',
  skill: 'Skills',
  goal: 'Goals',
  reflection: 'Reflections',
};

export default function Sidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const persons = useEngramStore((s) => s.persons);
  const activePersonId = useEngramStore((s) => s.activePersonId);
  const setActivePersonId = useEngramStore((s) => s.setActivePersonId);
  const activeCloudType = useEngramStore((s) => s.activeCloudType);
  const setActiveCloudType = useEngramStore((s) => s.setActiveCloudType);
  const navigate = useNavigate();

  if (!sidebarOpen) return null;

  const handleCloudClick = (type: CloudType) => {
    if (activeCloudType === type) {
      setActiveCloudType(null);
      navigate('/');
    } else {
      setActiveCloudType(type);
      navigate(`/cloud/${type}`);
    }
  };

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="w-56 bg-surface border-r border-border flex flex-col h-full shrink-0"
    >
      {/* Person selector */}
      <div className="p-3 border-b border-border">
        <label htmlFor="person-select" className="text-text-secondary text-xs uppercase tracking-wider block mb-1">
          Person
        </label>
        <select
          id="person-select"
          value={activePersonId ?? ''}
          onChange={(e) => setActivePersonId(e.target.value ? Number(e.target.value) : null)}
          className="w-full bg-background border border-border rounded px-2 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent-gold"
        >
          {persons.length === 0 && <option value="">No persons</option>}
          {persons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Cloud type filters */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 mb-2">
          <span className="text-text-secondary text-xs uppercase tracking-wider">Clouds</span>
        </div>
        {VALID_CLOUD_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => handleCloudClick(type)}
            className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm transition-colors ${
              activeCloudType === type
                ? 'bg-accent-gold/10 text-accent-gold border-r-2 border-accent-gold'
                : 'text-text-secondary hover:text-text-primary hover:bg-background/50'
            }`}
            aria-current={activeCloudType === type ? 'page' : undefined}
          >
            <span className="text-base">{CLOUD_ICONS[type]}</span>
            <span>{CLOUD_LABELS[type]}</span>
          </button>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-border py-2">
        <NavLink
          to="/timeline"
          className={({ isActive }) =>
            `block px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'text-accent-gold bg-accent-gold/10'
                : 'text-text-secondary hover:text-text-primary hover:bg-background/50'
            }`
          }
        >
          📅 Timeline
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `block px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'text-accent-gold bg-accent-gold/10'
                : 'text-text-secondary hover:text-text-primary hover:bg-background/50'
            }`
          }
        >
          ⚙️ Settings
        </NavLink>
      </div>
    </nav>
  );
}
