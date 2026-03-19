import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { settingsRepository } from '../../repositories';
import { storeApiKey, getApiKey, deleteApiKey, hasApiKey } from '../../lib/keychain';
import type { ApiProvider } from '../../lib/keychain';

interface ProviderMeta {
  id: ApiProvider;
  label: string;
  defaultModel: string;
  models: string[];
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-1.5-flash',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-opus-4-5'],
  },
];

interface ProviderState {
  hasKey: boolean;
  keyInput: string;
  model: string;
  testing: boolean;
  testResult: { ok: boolean; message: string } | null;
  saving: boolean;
}

type AllStates = Record<ApiProvider, ProviderState>;

const DEFAULT_STATES: AllStates = {
  gemini: { hasKey: false, keyInput: '', model: 'gemini-1.5-flash', testing: false, testResult: null, saving: false },
  openai: { hasKey: false, keyInput: '', model: 'gpt-4o-mini', testing: false, testResult: null, saving: false },
  anthropic: { hasKey: false, keyInput: '', model: 'claude-3-5-haiku-20241022', testing: false, testResult: null, saving: false },
};

export default function AISettings() {
  const [activeProvider, setActiveProvider] = useState<ApiProvider>('gemini');
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider>('gemini');
  const [states, setStates] = useState<AllStates>(DEFAULT_STATES);

  useEffect(() => {
    Promise.all([
      settingsRepository.get('ai_provider'),
      settingsRepository.get('ai_model_gemini'),
      settingsRepository.get('ai_model_openai'),
      settingsRepository.get('ai_model_anthropic'),
      hasApiKey('gemini'),
      hasApiKey('openai'),
      hasApiKey('anthropic'),
    ]).then(([prov, mGemini, mOpenai, mAnthropic, hGemini, hOpenai, hAnthropic]) => {
      if (prov) {
        setActiveProvider(prov as ApiProvider);
        setSelectedProvider(prov as ApiProvider);
      }
      setStates((prev) => ({
        gemini: { ...prev.gemini, hasKey: !!hGemini, model: mGemini ?? prev.gemini.model },
        openai: { ...prev.openai, hasKey: !!hOpenai, model: mOpenai ?? prev.openai.model },
        anthropic: { ...prev.anthropic, hasKey: !!hAnthropic, model: mAnthropic ?? prev.anthropic.model },
      }));
    }).catch(() => {});
  }, []);

  const updateState = (provider: ApiProvider, patch: Partial<ProviderState>) => {
    setStates((prev) => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));
  };

  const handleSaveKey = async (provider: ApiProvider) => {
    const { keyInput, model } = states[provider];
    if (!keyInput.trim()) return;
    updateState(provider, { saving: true });
    try {
      await storeApiKey(provider, keyInput.trim());
      await settingsRepository.set('ai_model_' + provider, model);
      updateState(provider, { hasKey: true, keyInput: '', saving: false, testResult: null });
    } catch (err) {
      console.error('Failed to save key:', err);
      updateState(provider, { saving: false });
    }
  };

  const handleDeleteKey = async (provider: ApiProvider) => {
    await deleteApiKey(provider).catch(() => {});
    updateState(provider, { hasKey: false, keyInput: '', testResult: null });
  };

  const handleTestConnection = async (provider: ApiProvider) => {
    updateState(provider, { testing: true, testResult: null });
    try {
      const key = await getApiKey(provider);
      if (!key) {
        updateState(provider, { testing: false, testResult: { ok: false, message: 'No API key stored.' } });
        return;
      }
      const result = await invoke<{ ok: boolean; model: string; message: string }>('test_api_key', {
        provider,
        key,
        model: states[provider].model,
      });
      updateState(provider, { testing: false, testResult: { ok: result.ok, message: result.message } });
    } catch (err) {
      updateState(provider, {
        testing: false,
        testResult: { ok: false, message: err instanceof Error ? err.message : 'Connection failed' },
      });
    }
  };

  const handleSetActive = async (provider: ApiProvider) => {
    setActiveProvider(provider);
    await settingsRepository.set('ai_provider', provider).catch(() => {});
  };

  const handleModelChange = async (provider: ApiProvider, model: string) => {
    updateState(provider, { model });
    await settingsRepository.set('ai_model_' + provider, model).catch(() => {});
  };

  const providerMeta = PROVIDERS.find((p) => p.id === selectedProvider)!;
  const s = states[selectedProvider];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">AI Configuration</h2>
        <p className="text-slate-400 text-sm mt-1">Configure AI providers for engram extraction and analysis.</p>
      </div>

      {/* Active provider */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <p className="text-sm font-medium text-white mb-3">Active Provider</p>
        <div className="flex flex-col gap-2">
          {PROVIDERS.map((p) => (
            <label key={p.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="active_provider"
                value={p.id}
                checked={activeProvider === p.id}
                onChange={() => handleSetActive(p.id)}
                className="accent-amber-500"
              />
              <span className={`text-sm ${activeProvider === p.id ? 'text-amber-400 font-medium' : 'text-slate-300'}`}>
                {p.label}
              </span>
              {states[p.id].hasKey && (
                <span className="text-xs text-emerald-400 ml-auto">Key saved</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Provider tabs */}
      <div className="flex gap-1 bg-slate-800/40 border border-slate-700/50 rounded-lg p-1">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProvider(p.id)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selectedProvider === p.id
                ? 'bg-indigo-600/60 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {p.label.split(' ').pop()}
          </button>
        ))}
      </div>

      {/* Provider config */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 space-y-4">
        <p className="text-sm font-semibold text-white">{providerMeta.label}</p>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">API Key</label>
          {s.hasKey ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-400 text-sm font-mono">
                ••••••••••••
              </div>
              <button
                onClick={() => handleDeleteKey(selectedProvider)}
                className="px-3 py-2 bg-red-900/30 text-red-400 border border-red-800/40 rounded-lg text-sm hover:bg-red-900/50 transition-colors"
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={s.keyInput}
                onChange={(e) => updateState(selectedProvider, { keyInput: e.target.value })}
                placeholder={`Paste your ${providerMeta.label} API key`}
                className="flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60 placeholder-slate-500"
              />
              <button
                onClick={() => handleSaveKey(selectedProvider)}
                disabled={!s.keyInput.trim() || s.saving}
                className="px-3 py-2 bg-amber-500 text-black font-medium rounded-lg text-sm hover:bg-amber-400 transition-colors disabled:opacity-40"
              >
                {s.saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Model</label>
          <select
            value={s.model}
            onChange={(e) => handleModelChange(selectedProvider, e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60"
          >
            {providerMeta.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            onClick={() => handleTestConnection(selectedProvider)}
            disabled={!s.hasKey || s.testing}
            className="px-4 py-2 bg-slate-600/60 text-slate-200 border border-slate-500/50 rounded-lg text-sm hover:bg-slate-600 transition-colors disabled:opacity-40"
          >
            {s.testing ? 'Testing...' : 'Test Connection'}
          </button>
          {s.testResult && (
            <p className={`text-xs mt-2 ${s.testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {s.testResult.ok ? '✓ ' : '✗ '}
              {s.testResult.message}
            </p>
          )}
          {!s.hasKey && (
            <p className="text-xs text-slate-500 mt-1">Save an API key first to test the connection.</p>
          )}
        </div>
      </div>
    </div>
  );
}
