import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngramStore } from '../stores/engramStore';
import { createLifePhase, updateLifePhase, deleteLifePhase } from '../stores/engramService';
import type { LifePhase } from '../types/engram';

interface PhaseFormData {
  name: string;
  start_date: string;
  end_date: string;
  description: string;
}

const emptyForm: PhaseFormData = { name: '', start_date: '', end_date: '', description: '' };

export default function Timeline() {
  const navigate = useNavigate();
  const lifePhases = useEngramStore((s) => s.lifePhases);
  const engramItems = useEngramStore((s) => s.engramItems);
  const setActiveCloudType = useEngramStore((s) => s.setActiveCloudType);
  const activePersonId = useEngramStore((s) => s.activePersonId);
  const setError = useEngramStore((s) => s.setError);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<PhaseFormData>(emptyForm);

  const getItemCount = (phaseId: number) =>
    engramItems.filter((i) => i.life_phase_id === phaseId).length;

  const handlePhaseClick = (_phase: LifePhase) => {
    setActiveCloudType(null);
    navigate(`/cloud/memory`);
  };

  const startEdit = (phase: LifePhase) => {
    setEditingId(phase.id);
    setFormData({
      name: phase.name,
      start_date: phase.start_date,
      end_date: phase.end_date ?? '',
      description: phase.description ?? '',
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.start_date) return;

    try {
      if (editingId !== null) {
        await updateLifePhase(editingId, {
          name: formData.name,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          description: formData.description || null,
        });
        setEditingId(null);
      } else {
        if (!activePersonId) return;
        await createLifePhase({
          person_id: activePersonId,
          name: formData.name,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          description: formData.description || null,
        });
        setShowCreateForm(false);
      }
      setFormData(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save life phase');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLifePhase(id);
      if (editingId === id) {
        setEditingId(null);
        setFormData(emptyForm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete life phase');
    }
  };

  const renderForm = (isEdit: boolean) => (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-text-secondary text-xs block mb-1">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g., Childhood"
            className="w-full bg-background border border-border rounded px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent-gold"
            autoFocus
          />
        </div>
        <div>
          <label className="text-text-secondary text-xs block mb-1">Description</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData((d) => ({ ...d, description: e.target.value }))}
            placeholder="Optional description"
            className="w-full bg-background border border-border rounded px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent-gold"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-text-secondary text-xs block mb-1">Start date</label>
          <input
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData((d) => ({ ...d, start_date: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent-gold"
          />
        </div>
        <div>
          <label className="text-text-secondary text-xs block mb-1">End date</label>
          <input
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData((d) => ({ ...d, end_date: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent-gold"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => {
            isEdit ? setEditingId(null) : setShowCreateForm(false);
            setFormData(emptyForm);
          }}
          className="px-3 py-1.5 text-text-secondary text-sm hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 bg-accent-gold text-background rounded-lg text-sm font-medium hover:bg-accent-gold/90 transition-colors"
        >
          {isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-text-primary">📅 Life Phases</h2>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setEditingId(null);
            setFormData(emptyForm);
          }}
          className="px-3 py-1.5 bg-accent-gold text-background rounded-lg text-sm font-medium hover:bg-accent-gold/90 transition-colors"
        >
          + New Phase
        </button>
      </div>

      {showCreateForm && !editingId && (
        <div className="mb-4">{renderForm(false)}</div>
      )}

      {lifePhases.length === 0 && !showCreateForm ? (
        <div className="text-center py-16">
          <span className="text-4xl block mb-3">📅</span>
          <p className="text-text-secondary text-sm">No life phases defined yet.</p>
          <p className="text-text-secondary/60 text-xs mt-1">
            Create phases to organize engrams by periods of your life.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          {lifePhases.map((phase) => {
            const count = getItemCount(phase.id);
            const isEditing = editingId === phase.id;

            return (
              <div key={phase.id} className="relative pl-10 pb-6">
                <div
                  className={`absolute left-[11px] top-1.5 w-[10px] h-[10px] rounded-full border-2 ${
                    phase.end_date
                      ? 'bg-surface border-text-secondary'
                      : 'bg-accent-gold border-accent-gold'
                  }`}
                />

                {isEditing ? (
                  renderForm(true)
                ) : (
                  <div
                    className="bg-surface border border-border rounded-lg p-4 cursor-pointer hover:border-accent-gold/50 transition-all group"
                    onClick={() => handlePhaseClick(phase)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-text-primary font-medium text-sm group-hover:text-accent-gold transition-colors">
                          {phase.name}
                        </h3>
                        <p className="text-text-secondary text-xs mt-0.5">
                          {phase.start_date} → {phase.end_date ?? 'present'}
                        </p>
                        {phase.description && (
                          <p className="text-text-secondary/70 text-xs mt-1">{phase.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-accent-gold text-xs">{count} engram{count !== 1 ? 's' : ''}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(phase);
                          }}
                          className="text-text-secondary/40 hover:text-text-primary text-xs transition-colors"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(phase.id);
                          }}
                          className="text-text-secondary/40 hover:text-red-400 text-xs transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
