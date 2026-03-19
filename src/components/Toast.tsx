import { useEffect } from 'react';
import { useEngramStore } from '../stores/engramStore';

export default function Toast() {
  const error = useEngramStore((s) => s.error);
  const setError = useEngramStore((s) => s.setError);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  if (!error) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 bg-red-900/90 border border-red-700 text-text-primary px-4 py-3 rounded-lg shadow-lg max-w-sm z-50 flex items-start gap-2"
    >
      <span className="text-red-400 shrink-0">⚠</span>
      <p className="text-sm">{error}</p>
      <button
        onClick={() => setError(null)}
        className="text-text-secondary hover:text-text-primary ml-auto shrink-0"
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  );
}
