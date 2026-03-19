/**
 * QuickCaptureModal — global hotkey (Cmd+Shift+E) quick-capture overlay.
 *
 * On open: reads clipboard content, detects type, pre-fills fields.
 * Supports: Save to Engram | Extract with AI | Cancel.
 * macOS-only feature; rendered only when `isOpen` is true.
 */

import { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../lib/useFocusTrap';
import { detectContentType, readClipboard, titleFromContent } from '../lib/quickCapture';
import type { CloudType } from '../types/engram';
import { VALID_CLOUD_TYPES } from '../types/engram';
import { useEngramStore } from '../stores/engramStore';
import { createEngramItem } from '../stores/engramService';
import { useNavigate } from 'react-router-dom';

const CLOUD_LABELS: Record<CloudType, string> = {
  memory: 'Memory',
  knowledge: 'Knowledge',
  belief: 'Belief',
  value: 'Value',
  skill: 'Skill',
  goal: 'Goal',
  reflection: 'Reflection',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickCaptureModal({ isOpen, onClose }: Props) {
  const trapRef = useFocusTrap(isOpen, onClose);
  const navigate = useNavigate();
  const activePersonId = useEngramStore((s) => s.activePersonId);

  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [cloudType, setCloudType] = useState<CloudType>('memory');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contentRef = useRef<HTMLTextAreaElement>(null);

  // On open: read clipboard and pre-fill
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSaving(false);
    setExtracting(false);
    setDate(new Date().toISOString().slice(0, 10));
    setTags('');

    readClipboard().then((clip) => {
      const trimmed = clip.trim();
      if (trimmed) {
        setContent(trimmed);
        setTitle(titleFromContent(trimmed));
        setCloudType(detectContentType(trimmed));
      } else {
        setContent('');
        setTitle('');
        setCloudType('memory');
      }
      // Focus textarea after fill
      setTimeout(() => contentRef.current?.focus(), 50);
    });
  }, [isOpen]);

  // Update title suggestion when content changes (only if user hasn't manually edited title)
  const titleManualRef = useRef(false);
  const handleContentChange = (val: string) => {
    setContent(val);
    if (!titleManualRef.current) {
      setTitle(titleFromContent(val));
      setCloudType(detectContentType(val));
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Content cannot be empty.');
      return;
    }
    if (!activePersonId) {
      setError('No active profile. Open the app fully first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const item = await createEngramItem({
        person_id: activePersonId,
        cloud_type: cloudType,
        title: title.trim() || titleFromContent(content),
        content: content.trim(),
        date: date || null,
      });
      onClose();
      navigate(`/experience/${item.uuid}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleExtractWithAI = async () => {
    if (!content.trim()) {
      setError('Content cannot be empty.');
      return;
    }
    setExtracting(true);
    setError(null);
    // Navigate to import with pre-filled content
    onClose();
    navigate('/import', { state: { prefillContent: content.trim() } });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div
        ref={trapRef as React.RefObject<HTMLDivElement>}
        className="bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <h2 className="text-white font-semibold text-sm">Quick Capture</h2>
            <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded font-mono">
              ⌘⇧E
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Content */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Content</label>
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              rows={5}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-indigo-500/60 placeholder-slate-500"
              placeholder="Paste or type content to capture…"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                titleManualRef.current = true;
                setTitle(e.target.value);
              }}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60 placeholder-slate-500"
              placeholder="Auto-generated from content"
            />
          </div>

          {/* Cloud type + Date row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Cloud</label>
              <select
                value={cloudType}
                onChange={(e) => setCloudType(e.target.value as CloudType)}
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60"
              >
                {VALID_CLOUD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CLOUD_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Tags <span className="text-slate-500">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60 placeholder-slate-500"
              placeholder="e.g. reading, ideas, work"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg text-sm hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExtractWithAI}
            disabled={extracting || saving}
            className="flex-1 px-4 py-2 bg-violet-600/80 text-white border border-violet-500/40 rounded-lg text-sm hover:bg-violet-600 transition-colors disabled:opacity-40"
          >
            {extracting ? 'Opening…' : '✨ Extract with AI'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || extracting}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save to Engram'}
          </button>
        </div>
      </div>
    </div>
  );
}
