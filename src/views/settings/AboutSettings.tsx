export default function AboutSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">About</h2>
        <p className="text-slate-400 text-sm mt-1">Engram Cloud application information.</p>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-5 space-y-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">App</p>
          <p className="text-white font-semibold text-base">Engram Cloud</p>
          <p className="text-slate-400 text-sm mt-0.5">Version 0.1.0</p>
        </div>

        <div className="border-t border-slate-700/50 pt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Built by</p>
          <p className="text-white">Ohana</p>
        </div>

        <div className="border-t border-slate-700/50 pt-4 space-y-2.5">
          {[
            'All data stored locally on your device',
            'No telemetry or usage tracking',
            'Your data is yours — export anytime',
            'Encrypted at rest with SQLCipher AES-256',
          ].map((line) => (
            <div key={line} className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <p className="text-sm text-slate-300">{line}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
