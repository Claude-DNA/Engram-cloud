/**
 * Deep link handler — macOS URL scheme: engram-cloud://
 *
 * Supported routes:
 *   engram-cloud://new                     -> open New Item modal
 *   engram-cloud://new?cloud=memory        -> New Item pre-set to cloud
 *   engram-cloud://search?q=...            -> search pre-filled
 *   engram-cloud://timeline                -> Timeline view
 *   engram-cloud://timeline?year=2019      -> Timeline filtered
 *   engram-cloud://item/{uuid}             -> navigate to item
 *   engram-cloud://import                  -> Import view
 *
 * On non-macOS (or in test environments without Tauri) all functions
 * are silent no-ops.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';

export type DeeplinkRoute =
  | { route: 'new'; params: { cloud?: string } }
  | { route: 'search'; params: { q?: string } }
  | { route: 'timeline'; params: { year?: string } }
  | { route: 'item'; itemId: string; params: Record<string, string> }
  | { route: 'import'; params: Record<string, string> };

export type DeeplinkHandler = (link: DeeplinkRoute) => void;

/** Parse a raw engram-cloud:// URL string into a typed DeeplinkRoute. */
export function parseDeeplinkUrl(url: string): DeeplinkRoute | null {
  try {
    const withoutScheme = url.replace(/^engram-cloud:\/\//, '');
    const [pathPart, queryPart = ''] = withoutScheme.split('?');
    const path = pathPart.replace(/^\//, '');

    const params: Record<string, string> = {};
    for (const pair of queryPart.split('&').filter(Boolean)) {
      const [k, v = 'true'] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }

    if (path === 'new') return { route: 'new', params };
    if (path === 'search') return { route: 'search', params };
    if (path === 'timeline') return { route: 'timeline', params };
    if (path === 'import') return { route: 'import', params };
    if (path.startsWith('item/')) {
      return { route: 'item', itemId: path.slice(5), params };
    }
    return null;
  } catch {
    return null;
  }
}

/** Convert a DeeplinkRoute into a react-router path + search string. */
export function deeplinkToRouterPath(link: DeeplinkRoute): string {
  switch (link.route) {
    case 'new': {
      const qs = link.params.cloud ? `?cloud=${link.params.cloud}&action=new` : '?action=new';
      return `/${qs}`;
    }
    case 'search': {
      const qs = link.params.q ? `?q=${encodeURIComponent(link.params.q)}` : '';
      return `/${qs}`;
    }
    case 'timeline': {
      const qs = link.params.year ? `?year=${link.params.year}` : '';
      return `/timeline${qs}`;
    }
    case 'item':
      return `/experience/${link.itemId}`;
    case 'import':
      return '/import';
  }
}

let _unlisten: UnlistenFn | null = null;

/**
 * Register a deep-link handler. Call once from App.tsx after unlock.
 * Returns an unsubscribe function.
 *
 * Handles both:
 *   - Cold-start URLs (onOpenUrl from the plugin)
 *   - In-app navigation events (deeplink://navigate emitted from Rust)
 */
export async function registerDeeplinkHandler(
  onLink: DeeplinkHandler,
): Promise<() => void> {
  const unlisteners: Array<() => void> = [];

  // 1. Handle URLs that arrive while the app is already running
  try {
    const unlisten = await listen<DeeplinkRoute>('deeplink://navigate', (event) => {
      if (event.payload) onLink(event.payload);
    });
    unlisteners.push(unlisten);
  } catch {
    // Not in a Tauri context (e.g. tests)
  }

  // 2. Handle cold-start deep links via the plugin
  try {
    const unlisten = await onOpenUrl((urls: string[]) => {
      for (const url of urls) {
        const parsed = parseDeeplinkUrl(url);
        if (parsed) onLink(parsed);
      }
    });
    if (typeof unlisten === 'function') {
      unlisteners.push(unlisten as () => void);
    }
  } catch {
    // Plugin not available in test / non-macOS
  }

  _unlisten = () => unlisteners.forEach((fn) => fn());
  return _unlisten;
}

/** Programmatically trigger deep-link navigation (useful for tests). */
export async function navigateViaDeeplink(url: string): Promise<void> {
  try {
    await invoke('handle_deeplink_url', { url });
  } catch {
    // No-op outside Tauri
  }
}
