import { useState, useEffect } from 'react';
import type { CloudType, EngramItem, LifePhase } from '../types/engram';
import { VALID_CLOUD_TYPES } from '../types/engram';
import { useEngramStore } from '../stores/engramStore';
import { useFocusTrap } from '../lib/useFocusTrap';

const CLOUD_LABELS: Record<CloudType, string> = {
  memory: 'Memory',
  knowledge: 'Knowledge',
  belief: 'Belief',
  value: 'Value',
  skill: 'Skill',
  goal: 'Goal',
  reflection: 'Reflection',
};

interface EngramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    cloud_type: CloudType;
    title: string;
    content: string;
    date: string | null;
    life_phase_id: number | null;
  }) => void;
  editItem?: EngramItem | null;
}

export default function EngramModal({ isOpen, onClose, onSave, editItem }: EngramModalProps) {
  const lifePhases = useEngramStore((s) => s.lifePhases);
  const activeCloudType = useEngramStore((s) => s.activeCloudType);
  const trapRef = useFocusTrap(isOpen, onClose);

  const [cloudType, setCloudType] = useState<CloudType>(activeCloudType ?? 'memory');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [lifePhaseId, setLifePhaseId] = useState<number | null>(null);

  useEffect(() => {
    if (editItem) {
      setCloudType(editItem.cloud_type);
      setTitle(editItem.title);
      setContent(editItem.content);
      setDate(editItem.date ?? '');
      setLifePhaseId(editItem.life_phase_id);
    } else {
      setCloudType(activeCloudType ?? 'memory');
      setTitle('');
      setContent('');
      setDate('');
      setLifePhaseId(null);
    }
  }, [editItem, activeCloudType, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave({
      cloud_type: cloudType,
      title: title.trim(),
      content: content.trim(),
      date: date || null,
      life_phase_id: lifePhaseId,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={editItem ? 'Edit engram' : 'Create engram'}
    >
      <div ref={trapRef}>
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-text-primary font-semibold">
              {editItem ? 'Edit Engram' : 'New Engram'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label htmlFor="cloud-type" className="text-text-secondary text-xs uppercase tracking-wider block mb-1">
                Cloud Type
              </label>
              <select
                id="cloud-type"
                value={cloudType}
                onChange={(e) => setCloudType(e.target.value as CloudType)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-gold"
              >
                {VALID_CLOUD_TYPES.map((t) => (
                  <option key={t} value={t}>{CLOUD_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="engram-title" className="text-text-secondary text-xs uppercase tracking-wider block mb-1">
                Title
              </label>
              <input
                id="engram-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What is this engram about?"
                className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-gold"
                required
              />
            </div>

            <div>
              <label htmlFor="engram-content" className="text-text-secondary text-xs uppercase tracking-wider block mb-1">
                Content
              </label>
              <textarea
                id="engram-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe this engram in detail…"
                rows={6}
                className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-gold resize-y"
                required
              />
            </div>

            <div>
              <label htmlFor="engram-date" className="text-text-secondary text-xs uppercase tracking-wider block mb-1">
                Date <span className="text-text-secondary/40">(optional)</span>
              </label>
              <input
                id="engram-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-gold"
              />
            </div>

            {lifePhases.length > 0 && (
              <div>
                <label htmlFor="life-phase" className="text-text-secondary text-xs uppercase tracking-wider block mb-1">
                  Life Phase <span className="text-text-secondary/40">(optional)</span>
                </label>
                <select
                  id="life-phase"
                  value={lifePhaseId ?? ''}
                  onChange={(e) => setLifePhaseId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                >
                  <option value="">None</option>
                  {lifePhases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.start_date}–{p.end_date ?? 'present'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-accent-gold text-background rounded-lg text-sm font-medium hover:bg-accent-gold/90 transition-colors"
            >
              {editItem ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
