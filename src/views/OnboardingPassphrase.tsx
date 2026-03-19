import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';

function getStrength(pass: string): { score: number; label: string; color: string } {
  if (pass.length === 0) return { score: 0, label: '', color: '' };

  let score = 0;
  if (pass.length >= 8) score++;
  if (pass.length >= 12) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-yellow-400' };
  return { score, label: 'Strong', color: 'bg-emerald-500' };
}

export default function OnboardingPassphrase() {
  const [step, setStep] = useState<1 | 2>(1);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Recovery key state
  const [recoveryWords, setRecoveryWords] = useState<string[]>([]);
  const [savedChecked, setSavedChecked] = useState(false);

  const setFirstLaunch = useAuthStore((s) => s.setFirstLaunch);
  const unlock = useAuthStore((s) => s.unlock);

  const strength = getStrength(passphrase);
  const strengthBars = Math.min(4, Math.ceil((strength.score / 5) * 4));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters.');
      return;
    }
    if (passphrase !== confirm) {
      setError('Passphrases do not match.');
      return;
    }

    setLoading(true);
    try {
      await invoke('create_passphrase', { passphrase });
      // Generate recovery key — Rust hashes and stores it, returns the 24 words
      const words = await invoke<string[]>('generate_recovery_key');
      setRecoveryWords(words);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    // Recovery key is already hashed and stored by generate_recovery_key
    setFirstLaunch(false);
    await unlock(passphrase);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 20%, #6366f1 0%, transparent 55%), radial-gradient(circle at 70% 80%, #8b5cf6 0%, transparent 55%)',
        }}
      />

      {step === 1 ? (
        <div className="relative w-full max-w-md mx-4 rounded-2xl border border-indigo-500/20 bg-slate-800/90 p-8 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mb-3 text-5xl">🧠</div>
            <h1 className="text-2xl font-bold text-white">Welcome to Engram Cloud</h1>
            <p className="mt-1 text-sm text-slate-400">
              Create a passphrase to protect your memories
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Passphrase field */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-400 uppercase tracking-wide">
                Passphrase
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-4 py-3 pr-12 text-white placeholder-slate-500 outline-none transition-all focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide passphrase' : 'Show passphrase'}
                >
                  {showPass ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Strength meter */}
              {passphrase.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          bar <= strengthBars ? strength.color : 'bg-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Strength:{' '}
                    <span
                      className={
                        strength.score <= 2
                          ? 'text-amber-400'
                          : strength.score <= 3
                            ? 'text-yellow-400'
                            : 'text-emerald-400'
                      }
                    >
                      {strength.label}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm field */}
            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-medium text-slate-400 uppercase tracking-wide">
                Confirm Passphrase
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter passphrase"
                  className="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-4 py-3 pr-12 text-white placeholder-slate-500 outline-none transition-all focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide confirm passphrase' : 'Show confirm passphrase'}
                >
                  {showConfirm ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Match indicator */}
              {confirm.length > 0 && (
                <p
                  className={`mt-1 text-xs ${
                    passphrase === confirm ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {passphrase === confirm ? '✓ Passphrases match' : '✗ Passphrases do not match'}
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="mb-4 text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || passphrase.length < 8 || passphrase !== confirm}
              className="w-full rounded-lg bg-amber-500/90 px-4 py-3 font-semibold transition-all hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ color: '#1e1b2e' }}
            >
              {loading ? 'Creating…' : 'Create Passphrase'}
            </button>
          </form>
        </div>
      ) : (
        /* Step 2: Recovery Key */
        <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-indigo-500/20 bg-slate-800/90 p-8 shadow-2xl backdrop-blur-sm max-h-[90vh] overflow-y-auto">
          <div className="mb-5 text-center">
            <div className="mb-2 text-4xl">🔑</div>
            <h1 className="text-xl font-bold text-white">Save Your Recovery Key</h1>
            <p className="mt-1 text-sm text-slate-400">Step 2 of 2</p>
          </div>

          {/* Warning */}
          <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <div className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-amber-400">⚠️</span>
              <p className="text-xs leading-relaxed text-amber-300/90">
                <span className="font-semibold">Write these 24 words down.</span>{' '}
                This is the ONLY way to recover if you forget your passphrase. Store them somewhere safe and offline.
              </p>
            </div>
          </div>

          {/* 6×4 word grid */}
          <div className="mb-5 grid grid-cols-6 gap-2">
            {recoveryWords.map((word, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-600/40 bg-slate-700/50 px-2 py-2 text-center"
              >
                <span className="block text-[10px] text-slate-500 leading-none mb-0.5">{i + 1}</span>
                <span className="text-xs font-mono font-medium text-slate-200">{word}</span>
              </div>
            ))}
          </div>

          {/* Confirmation checkbox */}
          <label className="mb-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={savedChecked}
              onChange={(e) => setSavedChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500 cursor-pointer"
            />
            <span className="text-sm text-slate-300">
              I have written down my 24 recovery words and stored them safely.
            </span>
          </label>

          {error && (
            <p className="mb-3 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!savedChecked || loading}
            className="w-full rounded-lg bg-amber-500/90 px-4 py-3 font-semibold transition-all hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: '#1e1b2e' }}
          >
            {loading ? 'Saving…' : 'Continue to App'}
          </button>
        </div>
      )}
    </div>
  );
}
