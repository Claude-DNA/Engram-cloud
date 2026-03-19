import { invoke } from "@tauri-apps/api/core";

export type ApiProvider = "gemini" | "openai" | "anthropic";

export async function storeApiKey(
  provider: ApiProvider,
  key: string
): Promise<void> {
  await invoke("store_api_key", { provider, key });
}

export async function getApiKey(
  provider: ApiProvider
): Promise<string | null> {
  return await invoke<string | null>("get_api_key", { provider });
}

export async function deleteApiKey(provider: ApiProvider): Promise<void> {
  await invoke("delete_api_key", { provider });
}

export async function hasApiKey(provider: ApiProvider): Promise<boolean> {
  return await invoke<boolean>("has_api_key", { provider });
}
