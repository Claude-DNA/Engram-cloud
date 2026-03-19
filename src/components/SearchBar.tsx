import { useState, useEffect } from 'react';
import { useEngramStore } from '../stores/engramStore';
import { useDebounce } from '../lib/useDebounce';

export default function SearchBar() {
  const searchQuery = useEngramStore((s) => s.searchQuery);
  const setSearchQuery = useEngramStore((s) => s.setSearchQuery);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debouncedQuery = useDebounce(localQuery, 300);

  // Sync debounced value → store
  useEffect(() => {
    setSearchQuery(debouncedQuery);
  }, [debouncedQuery, setSearchQuery]);

  // Sync store → local (for external resets)
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
      </svg>
      <input
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        placeholder="Search engrams…"
        className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-gold transition-colors"
        aria-label="Search engrams"
      />
      {localQuery && (
        <button
          onClick={() => {
            setLocalQuery('');
            setSearchQuery('');
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
