import { useState, useEffect, useCallback, useRef } from 'react';
import { useEngramStore } from '../stores/engramStore';
import { useDebounce } from '../lib/useDebounce';
import { TRANSFORMATION_TYPES } from '../types/transformationTypes';
import type { EngramItem, CloudType } from '../types/engram';

const CLOUD_BADGES: Record<CloudType, { icon: string; color: string }> = {
  memory: { icon: '🧠', color: 'bg-purple-900/40 text-purple-300' },
  knowledge: { icon: '📚', color: 'bg-blue-900/40 text-blue-300' },
  belief: { icon: '✨', color: 'bg-amber-900/40 text-amber-300' },
  value: { icon: '💎', color: 'bg-emerald-900/40 text-emerald-300' },
  skill: { icon: '🛠', color: 'bg-orange-900/40 text-orange-300' },
  goal: { icon: '🎯', color: 'bg-red-900/40 text-red-300' },
  reflection: { icon: '🪞', color: 'bg-cyan-900/40 text-cyan-300' },
};

interface LinkEngramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLink: (targetId: number, transformationType: string) => void;
  sourceItem: EngramItem;
  existingLinkIds: number[];
}

export default function LinkEngramModal({
  isOpen,
  onClose,
  onLink,
  sourceItem,
  existingLinkIds,
}: LinkEngramModalProps) {
  const engramItems = useEngramStore((s) => s.engramItems);

  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState(TRANSFORMATION_TYPES[0].id);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const debouncedSearch = useDebounce(searchText, 200);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter results
  const results = engramItems.filter((item) => {
    if (item.id === sourceItem.id) return false;
    if (existingLinkIds.includes(item.id)) return false;
    if (!debouncedSearch.trim()) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q)
    );
  });

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSearchText('');
      setSelectedType(TRANSFORMATION_TYPES[0].id);
      setHighlightedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [debouncedSearch]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-result-item]');
      items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        onLink(results[highlightedIndex].id, selectedType);
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [results, highlightedIndex, selectedType, onLink, onClose],
  );

  if (!isOpen) return null;

  const typeDef = TRANSFORMATION_TYPES.find((t) => t.id === selectedType)!;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Link engram"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="bg-surface border border-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-text-primary font-semibold">Link Engram</h2>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Transformation type selector */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {TRANSFORMATION_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  selectedType === t.id
                    ? 'bg-accent-gold/10 border-accent-gold text-accent-gold'
                    : 'border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.icon} {t.forwardLabel}
              </button>
            ))}
          </div>

          {/* Preview */}
          <p className="text-text-secondary text-xs">
            "{sourceItem.title}" <span className={typeDef.color}>{typeDef.forwardLabel}</span> →
          </p>

          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search for target engram…"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-gold mt-2"
            aria-label="Search engrams to link"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto" role="listbox">
          {results.length === 0 ? (
            <div className="p-6 text-center text-text-secondary text-sm">
              {debouncedSearch ? 'No matching engrams found.' : 'No engrams available to link.'}
            </div>
          ) : (
            results.slice(0, 50).map((item, idx) => {
              const badge = CLOUD_BADGES[item.cloud_type];
              return (
                <button
                  key={item.id}
                  data-result-item
                  role="option"
                  aria-selected={idx === highlightedIndex}
                  onClick={() => onLink(item.id, selectedType)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors ${
                    idx === highlightedIndex
                      ? 'bg-accent-gold/10'
                      : 'hover:bg-background/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.color}`}>
                      {badge.icon}
                    </span>
                    <span className="text-text-primary text-sm font-medium truncate">
                      {item.title}
                    </span>
                  </div>
                  <p className="text-text-secondary text-xs truncate pl-7">
                    {item.content.slice(0, 80)}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
