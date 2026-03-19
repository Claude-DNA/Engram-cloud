import { useState, useCallback } from 'react';
import { extractFromUrl, extractionToChunks, type UrlExtractionResult } from '../../engine/import/channels/UrlChannel';
import { urlTypeLabel, urlTypeEmoji } from '../../engine/import/channels/url/UrlTypeDetector';

interface Props {
  onChunksReady: (chunks: import('../../engine/import/types').ImportChunk[], sourceLabel: string) => void;
}

export default function UrlPasteInput({ onChunksReady }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UrlExtractionResult[]>([]);
  const [error, setError] = useState('');

  const handleGo = useCallback(async () => {
    const urls = inputValue
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http://') || l.startsWith('https://'));

    if (urls.length === 0) {
      setError('Please enter a valid URL (starting with http:// or https://)');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    const extracted: UrlExtractionResult[] = [];
    for (const url of urls) {
      const result = await extractFromUrl(url);
      extracted.push(result);
    }

    setResults(extracted);
    setLoading(false);
  }, [inputValue]);

  const handleProcess = useCallback(
    (result: UrlExtractionResult) => {
      const jobId = `url-${Date.now()}`;
      const chunks = extractionToChunks(result, jobId);
      if (chunks.length > 0) {
        onChunksReady(chunks, `${urlTypeEmoji(result.sourceType)} ${result.title || result.url}`);
      }
      // Remove from results
      setResults((prev) => prev.filter((r) => r !== result));
    },
    [onChunksReady],
  );

  const handleProcessAll = useCallback(() => {
    const successful = results.filter((r) => !r.error && r.text);
    for (const result of successful) {
      handleProcess(result);
    }
  }, [results, handleProcess]);

  return (
    <div className="space-y-3">
      {/* Input area */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <label className="text-text-secondary text-xs uppercase tracking-wider mb-2 block">
          🔗 Paste a link to extract
        </label>
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="https://... (one URL per line for batch)"
            rows={inputValue.includes('\n') ? 3 : 1}
            className="flex-1 rounded-lg border border-slate-600/50 bg-slate-700/50 px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !inputValue.includes('\n')) {
                e.preventDefault();
                handleGo();
              }
            }}
          />
          <button
            onClick={handleGo}
            disabled={loading || !inputValue.trim()}
            className="px-4 py-2 bg-amber-500/90 rounded-lg font-medium text-sm transition-all hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            style={{ color: '#1e1b2e' }}
          >
            {loading ? 'Extracting…' : 'Go'}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result, i) => (
            <div
              key={i}
              className={`bg-surface border rounded-xl p-4 ${
                result.error ? 'border-red-500/30' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{urlTypeEmoji(result.sourceType)}</span>
                    <span className="text-text-secondary text-xs">
                      {urlTypeLabel(result.sourceType)}
                    </span>
                  </div>

                  {result.error ? (
                    <p className="text-red-400 text-sm">{result.error}</p>
                  ) : (
                    <>
                      <p className="text-text-primary text-sm font-medium truncate">
                        {result.title || result.url}
                      </p>
                      {result.author && (
                        <p className="text-text-secondary text-xs">{result.author}</p>
                      )}
                      <p className="text-text-secondary text-xs mt-1 line-clamp-2">
                        {result.text.slice(0, 200)}
                        {result.text.length > 200 ? '…' : ''}
                      </p>
                    </>
                  )}
                </div>

                {!result.error && result.text && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleProcess(result)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-500 transition-colors"
                    >
                      Import
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {results.filter((r) => !r.error && r.text).length > 1 && (
            <button
              onClick={handleProcessAll}
              className="w-full py-2 bg-indigo-600/80 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors"
            >
              Import All ({results.filter((r) => !r.error && r.text).length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
