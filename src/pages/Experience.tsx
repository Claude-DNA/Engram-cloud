import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useEngramStore } from '../stores/engramStore';
import { updateEngramItem, deleteEngramItem } from '../stores/engramService';
import EngramModal from '../components/EngramModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { CloudType } from '../types/engram';

const CLOUD_BADGES: Record<CloudType, { icon: string; label: string; color: string }> = {
  memory: { icon: '🧠', label: 'Memory', color: 'bg-purple-900/40 text-purple-300' },
  knowledge: { icon: '📚', label: 'Knowledge', color: 'bg-blue-900/40 text-blue-300' },
  belief: { icon: '✨', label: 'Belief', color: 'bg-amber-900/40 text-amber-300' },
  value: { icon: '💎', label: 'Value', color: 'bg-emerald-900/40 text-emerald-300' },
  skill: { icon: '🛠', label: 'Skill', color: 'bg-orange-900/40 text-orange-300' },
  goal: { icon: '🎯', label: 'Goal', color: 'bg-red-900/40 text-red-300' },
  reflection: { icon: '🪞', label: 'Reflection', color: 'bg-cyan-900/40 text-cyan-300' },
};

export default function Experience() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const engramItems = useEngramStore((s) => s.engramItems);
  const setError = useEngramStore((s) => s.setError);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const item = useMemo(
    () => engramItems.find((i) => i.id === Number(id)) ?? null,
    [engramItems, id],
  );

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <span className="text-4xl mb-4">🔍</span>
        <p className="text-text-secondary text-sm">Engram not found.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-3 text-accent-gold text-sm hover:underline"
        >
          ← Go back
        </button>
      </div>
    );
  }

  const badge = CLOUD_BADGES[item.cloud_type];

  const handleSave = async (data: {
    cloud_type: CloudType;
    title: string;
    content: string;
    date: string | null;
    life_phase_id: number | null;
  }) => {
    try {
      await updateEngramItem(item.id, data);
      setEditModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update engram');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEngramItem(item.id);
      setDeleteDialogOpen(false);
      navigate(-1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete engram');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="text-text-secondary text-sm hover:text-text-primary transition-colors mb-4 flex items-center gap-1"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${badge.color} mb-2`}>
            <span>{badge.icon}</span>
            <span>{badge.label}</span>
          </span>
          <h1 className="text-2xl font-bold text-text-primary">{item.title}</h1>
          {item.date && (
            <span className="text-text-secondary text-sm mt-1 block">{item.date}</span>
          )}
        </div>
        <div className="flex gap-2 shrink-0 ml-4">
          <button
            onClick={() => setEditModalOpen(true)}
            className="px-3 py-1.5 text-sm text-accent-gold border border-accent-gold/30 rounded-lg hover:bg-accent-gold/10 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="px-3 py-1.5 text-sm text-red-400 border border-red-800/30 rounded-lg hover:bg-red-900/20 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-6">
        <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
          {item.content}
        </p>
      </div>

      {/* Metadata */}
      <div className="text-text-secondary/60 text-xs space-y-1">
        <p>Created: {item.created_at}</p>
        <p>Updated: {item.updated_at}</p>
        {item.uuid && <p>UUID: {item.uuid}</p>}
        {item.life_phase_id && <p>Life Phase ID: {item.life_phase_id}</p>}
      </div>

      {/* Modals */}
      <EngramModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSave}
        editItem={item}
      />
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete Engram"
        message={`Are you sure you want to delete "${item.title}"? This action can be undone later.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
