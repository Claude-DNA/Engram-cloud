/**
 * macOS-only settings: Deep Links, Spotlight Indexing, Quick Capture hotkey,
 * and Siri Shortcuts.
 *
 * Rendered only when running on macOS (platform guard in Settings.tsx).
 */

import { useState, useEffect } from 'react';
import { settingsRepository } from '../../repositories';
import { spotlightReindexAll } from '../../lib/spotlight';
import { navigateViaDeeplink } from '../../lib/deeplink';

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-indigo-500' : 'bg-slate-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

interface FlashMsg {
  text: string;
  type: 'error' | 'success' | 'info';
}

export default function MacOSSettings() {
  const [spotlightEnabled, setSpotlightEnabled] = useState(true);
  const [captureFromClipboard, setCaptureFromClipboard] = useState(true);
  const [hotkey, setHotkey] = useState('CmdOrCtrl+Shift+E');
  const [reindexing, setReindexing] = useState(false);
  const [msg, setMsg] = useState<FlashMsg | null>(null);

  useEffect(() => {
    Promise.all([
      settingsRepository.get('spotlight_enabled'),
      settingsRepository.get('quick_capture_clipboard'),
      settingsRepository.get('quick_capture_hotkey'),
    ]).then(([spotlight, clipboard, hk]) => {
      if (spotlight !== null) setSpotlightEnabled(spotlight !== 'false');
      if (clipboard !== null) setCaptureFromClipboard(clipboard !== 'false');
      if (hk) setHotkey(hk);
    }).catch(() => {});
  }, []);

  const flash = (text: string, type: FlashMsg['type'] = 'info') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  const handleSpotlightToggle = async (next: boolean) => {
    setSpotlightEnabled(next);
    await settingsRepository.set('spotlight_enabled', next ? 'true' : 'false').catch(() => {});
    flash(next ? 'Spotlight indexing enabled.' : 'Spotlight indexing disabled.', 'info');
  };

  const handleClipboardToggle = async (next: boolean) => {
    setCaptureFromClipboard(next);
    await settingsRepository.set('quick_capture_clipboard', next ? 'true' : 'false').catch(() => {});
  };

  const handleHotkeyChange = async (val: string) => {
    setHotkey(val);
    await settingsRepository.set('quick_capture_hotkey', val).catch(() => {});
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await spotlightReindexAll();
      flash('Spotlight index cleared. Items will be re-indexed on next access.', 'success');
    } catch {
      flash('Reindex failed. Check console for details.', 'error');
    } finally {
      setReindexing(false);
    }
  };

  const testDeepLink = async (url: string) => {
    await navigateViaDeeplink(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">macOS Features</h2>
        <p className="text-slate-400 text-sm mt-1">Apple Intelligence integrations.</p>
      </div>

      {msg && (
        <div
          className={`text-xs px-3 py-2 rounded-lg border ${
            msg.type === 'error'
              ? 'bg-red-900/20 border-red-500/30 text-red-400'
              : msg.type === 'success'
              ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400'
              : 'bg-indigo-900/20 border-indigo-500/30 text-indigo-300'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ── Spotlight Indexing ── */}
      <section className="space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
          Spotlight Indexing
        </p>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-white">Index in Spotlight</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Make engrams searchable via macOS Spotlight
              </p>
            </div>
            <Toggle checked={spotlightEnabled} onChange={handleSpotlightToggle} />
          </div>
          <button
            onClick={handleReindex}
            disabled={reindexing || !spotlightEnabled}
            className="px-3 py-1.5 bg-slate-600/60 text-slate-200 border border-slate-500/50 rounded-lg text-xs hover:bg-slate-600 transition-colors disabled:opacity-40"
          >
            {reindexing ? 'Clearing…' : 'Reindex All'}
          </button>
        </div>
      </section>

      {/* ── Quick Capture ── */}
      <section className="space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
          Quick Capture
        </p>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Capture from Clipboard</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Pre-fill Quick Capture with clipboard text on open
              </p>
            </div>
            <Toggle checked={captureFromClipboard} onChange={handleClipboardToggle} />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Global Hotkey</label>
            <input
              type="text"
              value={hotkey}
              onChange={(e) => handleHotkeyChange(e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500/60"
              placeholder="CmdOrCtrl+Shift+E"
            />
            <p className="text-xs text-slate-500 mt-1">
              Current shortcut: <span className="font-mono">⌘⇧E</span>. Restart required for changes.
            </p>
          </div>
        </div>
      </section>

      {/* ── Deep Links ── */}
      <section className="space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
          URL Scheme / Deep Links
        </p>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <p className="text-sm font-medium text-white mb-3">engram-cloud:// scheme</p>
          <div className="space-y-2 text-xs text-slate-400 font-mono">
            {[
              ['engram-cloud://new', 'Open New Item modal'],
              ['engram-cloud://new?cloud=memory', 'New Memory'],
              ['engram-cloud://search?q=…', 'Search pre-filled'],
              ['engram-cloud://timeline', 'Timeline view'],
              ['engram-cloud://timeline?year=2024', 'Timeline filtered'],
              ['engram-cloud://item/{uuid}', 'Jump to item'],
              ['engram-cloud://import', 'Import view'],
            ].map(([url, desc]) => (
              <div key={url} className="flex items-start gap-2">
                <button
                  onClick={() => testDeepLink(url.replace('…', 'test'))}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors shrink-0 mt-0.5"
                  title="Test this link"
                >
                  ▶
                </button>
                <div>
                  <span className="text-indigo-300">{url}</span>
                  <span className="text-slate-500 ml-2 font-sans not-italic">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Siri Shortcuts ── */}
      <section className="space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
          Siri Shortcuts
        </p>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <p className="text-sm font-medium text-white mb-1">Add Siri Shortcuts in Shortcuts.app</p>
          <p className="text-xs text-slate-400 mb-3">
            Open Shortcuts.app → New Shortcut → Add Action → Open URL → use an{' '}
            <span className="font-mono text-indigo-300">engram-cloud://</span> URL below.
          </p>
          <div className="space-y-3">
            {[
              {
                phrase: '"Hey Siri, add memory to Engram"',
                url: 'engram-cloud://new?cloud=memory',
                desc: 'Opens quick-add for a Memory',
              },
              {
                phrase: '"Hey Siri, open Engram timeline"',
                url: 'engram-cloud://timeline',
                desc: 'Jumps to Timeline view',
              },
              {
                phrase: '"Hey Siri, search Engram for [topic]"',
                url: 'engram-cloud://search?q=[topic]',
                desc: 'Pre-fills search bar',
              },
              {
                phrase: '"Hey Siri, import to Engram"',
                url: 'engram-cloud://import',
                desc: 'Opens the import screen',
              },
            ].map(({ phrase, url, desc }) => (
              <div
                key={url}
                className="border border-slate-700/40 rounded-lg p-3 space-y-1"
              >
                <p className="text-xs text-amber-400 font-medium">{phrase}</p>
                <p className="text-xs text-slate-400">{desc}</p>
                <p className="text-xs font-mono text-indigo-300">{url}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Siri uses the deep-link URL scheme — no additional configuration needed.
          </p>
        </div>
      </section>
    </div>
  );
}
