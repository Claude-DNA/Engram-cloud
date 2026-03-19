import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngramStore } from '../stores/engramStore';
import {
  getTransformations,
  onTransformationsChange,
} from '../stores/transformationService';
import {
  TRANSFORMATION_TYPE_MAP,
  getTransformationLabel,
} from '../types/transformationTypes';
import type { CloudType, EngramItem } from '../types/engram';
import type { Transformation } from '../types/engram';

const CLOUD_BADGES: Record<CloudType, { icon: string; label: string; color: string; bgColor: string }> = {
  memory: { icon: '🧠', label: 'Memory', color: 'text-purple-300', bgColor: 'bg-purple-900/30' },
  knowledge: { icon: '📚', label: 'Knowledge', color: 'text-blue-300', bgColor: 'bg-blue-900/30' },
  belief: { icon: '✨', label: 'Belief', color: 'text-amber-300', bgColor: 'bg-amber-900/30' },
  value: { icon: '💎', label: 'Value', color: 'text-emerald-300', bgColor: 'bg-emerald-900/30' },
  skill: { icon: '🛠', label: 'Skill', color: 'text-orange-300', bgColor: 'bg-orange-900/30' },
  goal: { icon: '🎯', label: 'Goal', color: 'text-red-300', bgColor: 'bg-red-900/30' },
  reflection: { icon: '🪞', label: 'Reflection', color: 'text-cyan-300', bgColor: 'bg-cyan-900/30' },
};

export default function Graph() {
  const navigate = useNavigate();
  const engramItems = useEngramStore((s) => s.engramItems);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    return onTransformationsChange(() => forceUpdate((n) => n + 1));
  }, []);

  const transformations = getTransformations();
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // Graph stats
  const stats = useMemo(() => {
    const connectedIds = new Set<number>();
    transformations.forEach((t) => {
      connectedIds.add(t.source_id);
      connectedIds.add(t.target_id);
    });

    const connectionCounts = new Map<number, number>();
    transformations.forEach((t) => {
      connectionCounts.set(t.source_id, (connectionCounts.get(t.source_id) ?? 0) + 1);
      connectionCounts.set(t.target_id, (connectionCounts.get(t.target_id) ?? 0) + 1);
    });

    let mostConnectedId: number | null = null;
    let maxCount = 0;
    connectionCounts.forEach((count, id) => {
      if (count > maxCount) {
        maxCount = count;
        mostConnectedId = id;
      }
    });

    const orphanCount = engramItems.filter((i) => !connectedIds.has(i.id)).length;

    return {
      totalNodes: connectedIds.size,
      totalEdges: transformations.length,
      mostConnected: mostConnectedId ? engramItems.find((i) => i.id === mostConnectedId) : null,
      mostConnectedCount: maxCount,
      orphanCount,
    };
  }, [transformations, engramItems]);

  // Get connections for selected item
  const selectedConnections = useMemo(() => {
    if (!selectedItemId) return { forward: [], inverse: [] };
    return {
      forward: transformations.filter((t) => t.source_id === selectedItemId),
      inverse: transformations.filter((t) => t.target_id === selectedItemId),
    };
  }, [selectedItemId, transformations]);

  const selectedItem = engramItems.find((i) => i.id === selectedItemId);

  // Group connections by type
  const groupedConnections = useMemo(() => {
    const groups = new Map<string, Array<{ transformation: Transformation; item: EngramItem; direction: 'forward' | 'inverse' }>>();

    [...selectedConnections.forward, ...selectedConnections.inverse].forEach((t) => {
      const direction = t.source_id === selectedItemId ? 'forward' : 'inverse';
      const linkedId = direction === 'forward' ? t.target_id : t.source_id;
      const item = engramItems.find((i) => i.id === linkedId);
      if (!item) return;

      const key = t.transformation_type;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ transformation: t, item, direction });
    });

    return groups;
  }, [selectedConnections, selectedItemId, engramItems]);

  // Items with connections for the node list
  const connectedItems = useMemo(() => {
    const ids = new Set<number>();
    transformations.forEach((t) => {
      ids.add(t.source_id);
      ids.add(t.target_id);
    });
    return engramItems.filter((i) => ids.has(i.id));
  }, [transformations, engramItems]);

  return (
    <div className="flex h-full">
      {/* Left: Node list */}
      <div className="w-64 border-r border-border bg-surface overflow-y-auto shrink-0">
        <div className="p-3 border-b border-border">
          <h2 className="text-text-primary font-semibold text-sm">🔗 Graph</h2>
          <p className="text-text-secondary text-xs mt-1">
            {stats.totalNodes} nodes · {stats.totalEdges} edges
          </p>
        </div>

        {/* Stats panel */}
        <div className="p-3 border-b border-border space-y-1.5 text-xs">
          {stats.mostConnected && (
            <div className="text-text-secondary">
              <span className="text-accent-gold">Most connected:</span>{' '}
              {stats.mostConnected.title} ({stats.mostConnectedCount})
            </div>
          )}
          <div className="text-text-secondary">
            <span className="text-text-secondary/60">Orphans:</span> {stats.orphanCount}
          </div>
        </div>

        {/* Node list */}
        {connectedItems.length === 0 ? (
          <div className="p-4 text-center text-text-secondary text-xs">
            No connections yet. Link engrams from their detail pages to build the graph.
          </div>
        ) : (
          connectedItems.map((item) => {
            const badge = CLOUD_BADGES[item.cloud_type];
            const isSelected = selectedItemId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors ${
                  isSelected
                    ? 'bg-accent-gold/10 border-r-2 border-accent-gold'
                    : 'hover:bg-background/50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs ${badge.color}`}>{badge.icon}</span>
                  <span className="text-text-primary text-sm truncate">{item.title}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Right: Adjacency detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedItem ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-4xl mb-3">🕸️</span>
            <p className="text-text-secondary text-sm">Select a node to view its connections</p>
            <p className="text-text-secondary/50 text-xs mt-1">
              Or link engrams from their detail pages
            </p>
          </div>
        ) : (
          <div>
            {/* Selected node header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${CLOUD_BADGES[selectedItem.cloud_type].bgColor} ${CLOUD_BADGES[selectedItem.cloud_type].color} mb-2`}>
                  {CLOUD_BADGES[selectedItem.cloud_type].icon} {CLOUD_BADGES[selectedItem.cloud_type].label}
                </span>
                <h2 className="text-xl font-bold text-text-primary">{selectedItem.title}</h2>
                <p className="text-text-secondary text-xs mt-1 line-clamp-2">{selectedItem.content}</p>
              </div>
              <button
                onClick={() => navigate(`/experience/${selectedItem.id}`)}
                className="px-3 py-1.5 text-sm text-accent-gold border border-accent-gold/30 rounded-lg hover:bg-accent-gold/10 transition-colors shrink-0"
              >
                View detail
              </button>
            </div>

            {/* Grouped connections */}
            {groupedConnections.size === 0 ? (
              <p className="text-text-secondary text-sm">No connections found.</p>
            ) : (
              Array.from(groupedConnections.entries()).map(([typeId, items]) => {
                const typeDef = TRANSFORMATION_TYPE_MAP.get(typeId);
                return (
                  <div key={typeId} className="mb-5">
                    <h3 className="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-2">
                      <span>{typeDef?.icon ?? '🔗'}</span>
                      <span className={typeDef?.color ?? ''}>{typeId}</span>
                    </h3>
                    <div className="space-y-1.5">
                      {items.map(({ transformation, item, direction }) => {
                        const badge = CLOUD_BADGES[item.cloud_type];
                        const label = getTransformationLabel(typeId, direction);
                        return (
                          <button
                            key={transformation.id}
                            onClick={() => navigate(`/experience/${item.id}`)}
                            className="w-full text-left flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg hover:border-accent-gold/50 transition-all"
                          >
                            <span className={`text-xs ${badge.color}`}>{badge.icon}</span>
                            <span className="text-text-secondary text-xs shrink-0">{label}</span>
                            <span className="text-text-primary text-sm truncate">{item.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
