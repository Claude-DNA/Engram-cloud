import { useNavigate } from 'react-router-dom';
import { useEngramStore } from '../stores/engramStore';
import {
  getTransformationLabel,
  TRANSFORMATION_TYPE_MAP,
} from '../types/transformationTypes';
import type { Transformation } from '../types/engram';
import type { CloudType } from '../types/engram';

const CLOUD_BADGES: Record<CloudType, { icon: string; color: string }> = {
  memory: { icon: '🧠', color: 'text-purple-300' },
  knowledge: { icon: '📚', color: 'text-blue-300' },
  belief: { icon: '✨', color: 'text-amber-300' },
  value: { icon: '💎', color: 'text-emerald-300' },
  skill: { icon: '🛠', color: 'text-orange-300' },
  goal: { icon: '🎯', color: 'text-red-300' },
  reflection: { icon: '🪞', color: 'text-cyan-300' },
};

interface ConnectionsListProps {
  itemId: number;
  forward: Transformation[];
  inverse: Transformation[];
  onDelete: (transformationId: number) => void;
  onAddClick: () => void;
}

export default function ConnectionsList({
  itemId,
  forward,
  inverse,
  onDelete,
  onAddClick,
}: ConnectionsListProps) {
  const navigate = useNavigate();
  const engramItems = useEngramStore((s) => s.engramItems);
  const totalLinks = forward.length + inverse.length;

  const findItem = (id: number) => engramItems.find((i) => i.id === id);

  const renderLink = (
    t: Transformation,
    direction: 'forward' | 'inverse',
  ) => {
    const linkedItemId = direction === 'forward' ? t.target_id : t.source_id;
    const linkedItem = findItem(linkedItemId);
    if (!linkedItem) return null;

    const typeDef = TRANSFORMATION_TYPE_MAP.get(t.transformation_type);
    const label = getTransformationLabel(t.transformation_type, direction);
    const badge = CLOUD_BADGES[linkedItem.cloud_type];

    return (
      <div
        key={`${t.id}-${direction}`}
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-background/50 transition-colors group"
      >
        <button
          onClick={() => navigate(`/experience/${linkedItem.id}`)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <span className={`text-xs ${typeDef?.color ?? 'text-text-secondary'}`}>
            {typeDef?.icon ?? '🔗'}
          </span>
          <span className="text-text-secondary text-xs shrink-0">
            {label}
          </span>
          <span className={`text-xs ${badge.color}`}>{badge.icon}</span>
          <span className="text-text-primary text-sm truncate hover:text-accent-gold transition-colors">
            {linkedItem.title}
          </span>
        </button>
        <button
          onClick={() => onDelete(t.id)}
          className="text-text-secondary/30 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all shrink-0"
          aria-label={`Remove link to ${linkedItem.title}`}
        >
          ✕
        </button>
      </div>
    );
  };

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-text-primary text-sm font-medium">
          🔗 Connections
          <span className="text-text-secondary/60 font-normal ml-1.5">
            ({totalLinks})
          </span>
        </h3>
        <button
          onClick={onAddClick}
          className="px-2.5 py-1 text-xs text-accent-gold border border-accent-gold/30 rounded hover:bg-accent-gold/10 transition-colors"
        >
          + Link
        </button>
      </div>

      {totalLinks === 0 ? (
        <div className="p-4 text-center text-text-secondary/60 text-xs">
          No connections yet. Link this engram to others to build your knowledge graph.
        </div>
      ) : (
        <div className="p-1">
          {forward.map((t) => renderLink(t, 'forward'))}
          {inverse.map((t) => renderLink(t, 'inverse'))}
        </div>
      )}
    </div>
  );
}
