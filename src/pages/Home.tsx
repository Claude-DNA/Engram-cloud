import { useNavigate } from 'react-router-dom';
import { useEngramStore } from '../stores/engramStore';
import type { CloudType } from '../types/engram';
import { VALID_CLOUD_TYPES } from '../types/engram';

const CLOUD_INFO: Record<CloudType, { icon: string; label: string; desc: string }> = {
  memory: { icon: '🧠', label: 'Memories', desc: 'Moments that shaped you' },
  knowledge: { icon: '📚', label: 'Knowledge', desc: 'What you\'ve learned' },
  belief: { icon: '✨', label: 'Beliefs', desc: 'What you hold true' },
  value: { icon: '💎', label: 'Values', desc: 'What matters most' },
  skill: { icon: '🛠', label: 'Skills', desc: 'What you can do' },
  goal: { icon: '🎯', label: 'Goals', desc: 'What you\'re reaching toward' },
  reflection: { icon: '🪞', label: 'Reflections', desc: 'What you\'re thinking about' },
};

export default function Home() {
  const navigate = useNavigate();
  const engramItems = useEngramStore((s) => s.engramItems);
  const isHydrated = useEngramStore((s) => s.isHydrated);
  const setActiveCloudType = useEngramStore((s) => s.setActiveCloudType);

  const counts = VALID_CLOUD_TYPES.reduce(
    (acc, type) => {
      acc[type] = engramItems.filter((i) => i.cloud_type === type).length;
      return acc;
    },
    {} as Record<CloudType, number>,
  );

  const handleCloudClick = (type: CloudType) => {
    setActiveCloudType(type);
    navigate(`/cloud/${type}`);
  };

  return (
    <div className="p-6">
      {/* Hero */}
      <div className="text-center mb-8 pt-4">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Engram <span className="text-accent-gold">Cloud</span>
        </h1>
        <p className="text-text-secondary text-sm">
          {isHydrated
            ? `${engramItems.length} engram${engramItems.length !== 1 ? 's' : ''} stored`
            : 'Loading your engrams…'}
        </p>
      </div>

      {/* Cloud type grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-3xl mx-auto">
        {VALID_CLOUD_TYPES.map((type) => {
          const info = CLOUD_INFO[type];
          return (
            <button
              key={type}
              onClick={() => handleCloudClick(type)}
              className="bg-surface border border-border rounded-lg p-4 text-left hover:border-accent-gold/50 transition-all hover:shadow-lg hover:shadow-accent-gold/5 group"
            >
              <span className="text-2xl block mb-2">{info.icon}</span>
              <h3 className="text-text-primary text-sm font-medium group-hover:text-accent-gold transition-colors">
                {info.label}
              </h3>
              <p className="text-text-secondary/60 text-xs mt-0.5">{info.desc}</p>
              <span className="text-accent-gold text-xs font-medium mt-2 block">
                {counts[type]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
