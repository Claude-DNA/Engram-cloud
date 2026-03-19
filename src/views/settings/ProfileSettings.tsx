import { useState, useEffect } from 'react';
import { settingsRepository } from '../../repositories';

export default function ProfileSettings() {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      settingsRepository.get('user_name'),
      settingsRepository.get('user_birth_date'),
    ]).then(([n, d]) => {
      if (n) setName(n);
      if (d) setBirthDate(d);
    }).catch(() => {});
  }, []);

  const saveField = async (key: string, value: string) => {
    try {
      await settingsRepository.set(key, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Profile</h2>
        <p className="text-slate-400 text-sm mt-1">Your personal information stored locally.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-600/40 border-2 border-indigo-500/60 flex items-center justify-center shrink-0">
          <span className="text-xl font-semibold text-indigo-200">{initials}</span>
        </div>
        <div>
          <p className="text-white text-sm font-medium">{name || 'Your Name'}</p>
          <p className="text-slate-400 text-xs mt-0.5">Avatar generated from your initials</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Display Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => saveField('user_name', name)}
          placeholder="Enter your name"
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60 placeholder-slate-500"
        />
        <p className="text-slate-500 text-xs mt-1">Auto-saved when you leave the field</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Birth Date</label>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          onBlur={() => saveField('user_birth_date', birthDate)}
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60 [color-scheme:dark]"
        />
        <p className="text-slate-500 text-xs mt-1">Used for life phase calculations</p>
      </div>

      {saved && (
        <p className="text-emerald-400 text-xs">Saved</p>
      )}
    </div>
  );
}
