import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';

export default function LockScreen() {
  const [passphrase, setPassphrase] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const unlock = useAuthStore((s) => s.unlock);
  const cooldownUntil = useAuthStore((s) => s.cooldownUntil);
  const setCooldownUntil = useAuthStore((s) => s.setCooldownUntil);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Countdown ticker when locked out
  useEffect(() => {
    if (!cooldownUntil) {
      setCountdown(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) setCooldownUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil, setCooldownUntil]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (countdown > 0) return;
    if (!passphrase) return;

    setError('');
    try {
      const ok = await invoke<boolean>('verify_passphrase', { passphrase });
      if (ok) {
        unlock();
      } else {
        setPassphrase('');
        setError('Incorrect passphrase. Please try again.');
        triggerShake();
        inputRef.current?.focus();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Parse cooldown from error message
      const match = msg.match(/(\d+) second/);
      if (match) {
        const secs = parseInt(match[1], 10);
        setCooldownUntil(Date.now() + secs * 1000);
        setError('');
      } else {
        setError(msg);
      }
      setPassphrase('');
      triggerShake();
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900">
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 25%, #6366f1 0%, transparent 50%), radial-gradient(circle at 75% 75%, #8b5cf6 0%, transparent 50%)',
        }}
      />

      <div
        className={`relative w-full max-w-sm mx-4 rounded-2xl border border-indigo-500/20 bg-slate-800/90 p-8 shadow-2xl backdrop-blur-sm${shake ? ' animate-shake' : ''}`}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🧠</div>
          <h1 className="text-2xl font-bold text-white">Engram Cloud</h1>
          <p className="mt-1 text-sm text-slate-400">Enter your passphrase to continue</p>
        </div>

        {/* Rate-limit lockout */}
        {countdown > 0 && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
            <p className="text-sm font-medium text-amber-400">Too many attempts</p>
            <p className="mt-1 text-xs text-amber-300/80">
              Try again in{' '}
              <span className="font-bold tabular-nums">
                {countdown}s
              </span>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="relative">
            <input
              ref={inputRef}
              type={showPass ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase"
              disabled={countdown > 0}
              className="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-4 py-3 pr-12 text-white placeholder-slate-500 outline-none transition-all focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
              autoComplete="current-password"
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

          {/* Error message */}
          {error && (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!passphrase || countdown > 0}
            className="mt-4 w-full rounded-lg bg-amber-500/90 px-4 py-3 font-semibold text-slate-900 transition-all hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: '#1e1b2e' }}
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
