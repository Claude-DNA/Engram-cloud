import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { settingsRepository } from '../../repositories';
import { useAuthStore } from '../../stores/authStore';

const TIMEOUT_OPTIONS = [
  { value: '1', label: '1 minute' },
  { value: '5', label: '5 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '0', label: 'Never' },
];

interface FlashMsg {
  text: string;
  type: 'error' | 'success' | 'info';
}

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
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-amber-500' : 'bg-slate-600'
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

export default function SecuritySettings() {
  const biometricAvailable = useAuthStore((s) => s.biometricAvailable);
  const [authRequired, setAuthRequired] = useState(true);
  const [lockTimeout, setLockTimeout] = useState('5');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [msg, setMsg] = useState<FlashMsg | null>(null);

  const [showPassModal, setShowPassModal] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [changingPass, setChangingPass] = useState(false);

  useEffect(() => {
    Promise.all([
      settingsRepository.get('auth_required'),
      settingsRepository.get('lock_timeout_minutes'),
      settingsRepository.get('biometric_enabled'),
    ]).then(([auth, timeout, bio]) => {
      setAuthRequired(auth !== 'false');
      if (timeout) setLockTimeout(timeout);
      setBiometricEnabled(bio === 'true');
    }).catch(() => {});
  }, []);

  const flash = (text: string, type: FlashMsg['type'] = 'info') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleAuthToggle = async (next: boolean) => {
    if (next) {
      try {
        const hasPass = await invoke<boolean>('has_passphrase');
        if (!hasPass) {
          flash('No passphrase set. Create one in the Change Passphrase section.', 'error');
          return;
        }
      } catch {
        flash('Could not verify passphrase status.', 'error');
        return;
      }
    }
    setAuthRequired(next);
    await settingsRepository.set('auth_required', next ? 'true' : 'false').catch(() => {});
    flash(next ? 'Authentication enabled.' : 'Authentication disabled — app will not lock.', 'info');
  };

  const handleTimeoutChange = async (value: string) => {
    setLockTimeout(value);
    await settingsRepository.set('lock_timeout_minutes', value).catch(() => {});
  };

  const handleBiometricToggle = async (next: boolean) => {
    if (!biometricAvailable) return;
    setBiometricEnabled(next);
    await settingsRepository.set('biometric_enabled', next ? 'true' : 'false').catch(() => {});
  };

  const closePassModal = () => {
    setShowPassModal(false);
    setCurrentPass('');
    setNewPass('');
    setConfirmPass('');
    setPassMsg(null);
  };

  const handleChangePassphrase = async () => {
    setPassMsg(null);
    if (!currentPass || !newPass || !confirmPass) {
      setPassMsg('All fields are required.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassMsg('New passphrases do not match.');
      return;
    }
    if (newPass.length < 8) {
      setPassMsg('Passphrase must be at least 8 characters.');
      return;
    }
    setChangingPass(true);
    try {
      await invoke('verify_passphrase', { passphrase: currentPass });
      await invoke('create_passphrase', { passphrase: newPass });
      closePassModal();
      flash('Passphrase changed successfully.', 'success');
    } catch (err) {
      setPassMsg(
        err instanceof Error ? err.message : 'Failed to change passphrase. Check your current passphrase.'
      );
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Security</h2>
        <p className="text-slate-400 text-sm mt-1">Authentication and access control settings.</p>
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

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Require Authentication</p>
            <p className="text-xs text-slate-400 mt-0.5">Lock on launch and idle</p>
          </div>
          <Toggle checked={authRequired} onChange={handleAuthToggle} />
        </div>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <label className="block text-sm font-medium text-white mb-2">Auto-Lock Timeout</label>
        <select
          value={lockTimeout}
          onChange={(e) => handleTimeoutChange(e.target.value)}
          disabled={!authRequired}
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60 disabled:opacity-40"
        >
          {TIMEOUT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Biometric Unlock</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {biometricAvailable ? 'Use Touch ID / Face ID' : 'Not available on this device'}
            </p>
          </div>
          <Toggle checked={biometricEnabled} onChange={handleBiometricToggle} disabled={!biometricAvailable} />
        </div>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <p className="text-sm font-medium text-white mb-2">Database Encryption</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-xs text-emerald-400">SQLCipher AES-256 encryption active</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">All data encrypted at rest using your passphrase.</p>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <p className="text-sm font-medium text-white mb-1">Passphrase</p>
        <p className="text-xs text-slate-400 mb-3">Change your encryption passphrase.</p>
        <button
          onClick={() => setShowPassModal(true)}
          className="px-4 py-2 bg-slate-600/60 text-slate-200 border border-slate-500/50 rounded-lg text-sm hover:bg-slate-600 transition-colors"
        >
          Change Passphrase
        </button>
      </div>

      {showPassModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="text-white font-semibold mb-4">Change Passphrase</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Current Passphrase</label>
                <input
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60"
                  placeholder="Current passphrase"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">New Passphrase</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60"
                  placeholder="New passphrase (min 8 chars)"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Confirm New Passphrase</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60"
                  placeholder="Repeat new passphrase"
                />
              </div>
              {passMsg && <p className="text-xs text-red-400">{passMsg}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={closePassModal}
                className="flex-1 px-4 py-2 bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg text-sm hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassphrase}
                disabled={changingPass}
                className="flex-1 px-4 py-2 bg-amber-500 text-black font-medium rounded-lg text-sm hover:bg-amber-400 transition-colors disabled:opacity-40"
              >
                {changingPass ? 'Changing...' : 'Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
