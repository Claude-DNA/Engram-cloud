import type { EngramItem, CloudType } from '../types/engram';

const CLOUD_BADGES: Record<CloudType, { icon: string; label: string; color: string }> = {
  memory: { icon: '🧠', label: 'Memory', color: 'bg-purple-900/40 text-purple-300' },
  knowledge: { icon: '📚', label: 'Knowledge', color: 'bg-blue-900/40 text-blue-300' },
  belief: { icon: '✨', label: 'Belief', color: 'bg-amber-900/40 text-amber-300' },
  value: { icon: '💎', label: 'Value', color: 'bg-emerald-900/40 text-emerald-300' },
  skill: { icon: '🛠', label: 'Skill', color: 'bg-orange-900/40 text-orange-300' },
  goal: { icon: '🎯', label: 'Goal', color: 'bg-red-900/40 text-red-300' },
  reflection: { icon: '🪞', label: 'Reflection', color: 'bg-cyan-900/40 text-cyan-300' },
};

interface EngramCardProps {
  item: EngramItem;
  onClick: (item: EngramItem) => void;
}

export default function EngramCard({ item, onClick }: EngramCardProps) {
  const badge = CLOUD_BADGES[item.cloud_type];
  const snippet =
    item.content.length > 120
      ? item.content.slice(0, 120) + '…'
      : item.content;

  return (
    <article
      role="article"
      onClick={() => onClick(item)}
      className="bg-surface border border-border rounded-lg p-4 cursor-pointer hover:border-accent-gold/50 transition-all hover:shadow-lg hover:shadow-accent-gold/5 group"
    >
      {/* Header: badge + date */}
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
          <span>{badge.icon}</span>
          <span>{badge.label}</span>
        </span>
        {item.date && (
          <span className="text-text-secondary text-xs">{item.date}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-text-primary font-medium text-sm mb-1.5 group-hover:text-accent-gold transition-colors line-clamp-2">
        {item.title}
      </h3>

      {/* Snippet */}
      <p className="text-text-secondary text-xs leading-relaxed line-clamp-3">
        {snippet}
      </p>
    </article>
  );
}
