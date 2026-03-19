/**
 * FTS5 query time logger.
 * Logs query performance for diagnostics and future AI integration (Phase 6).
 */

interface QueryLog {
  query: string;
  durationMs: number;
  resultCount: number;
  timestamp: string;
}

const _queryLogs: QueryLog[] = [];
const MAX_LOGS = 100;

export function logQuery(query: string, durationMs: number, resultCount: number): void {
  const entry: QueryLog = {
    query,
    durationMs,
    resultCount,
    timestamp: new Date().toISOString(),
  };

  _queryLogs.push(entry);
  if (_queryLogs.length > MAX_LOGS) {
    _queryLogs.shift();
  }

  // Console log for dev visibility
  console.log(
    `[FTS5] "${query}" → ${resultCount} results in ${durationMs.toFixed(1)}ms`,
  );
}

export function getQueryLogs(): QueryLog[] {
  return [..._queryLogs];
}

export function getAverageQueryTime(): number {
  if (_queryLogs.length === 0) return 0;
  const total = _queryLogs.reduce((sum, l) => sum + l.durationMs, 0);
  return total / _queryLogs.length;
}

/**
 * Wraps an async search function with timing and logging.
 */
export async function timedSearch<T>(
  query: string,
  searchFn: () => Promise<T[]>,
): Promise<T[]> {
  const start = performance.now();
  const results = await searchFn();
  const duration = performance.now() - start;
  logQuery(query, duration, results.length);
  return results;
}
