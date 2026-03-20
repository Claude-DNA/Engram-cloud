// OAuthManager.ts — manages OAuth flows for cloud/social providers
// Uses Tauri backend for localhost callback server

import { invoke } from '@tauri-apps/api/core';

export type OAuthProvider = 'google_drive' | 'dropbox' | 'twitter' | 'instagram' | 'youtube';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
}

export interface OAuthConfig {
  provider: OAuthProvider;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  scope: string;
  usePKCE: boolean;
}

const OAUTH_CONFIGS: Record<string, Partial<OAuthConfig>> = {
  google_drive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    usePKCE: false,
  },
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scope: '',
    usePKCE: true,
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scope: 'tweet.read users.read offline.access',
    usePKCE: true,
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scope: 'instagram_basic',
    usePKCE: false,
  },
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    usePKCE: false,
  },
};

export class OAuthManager {
  // Start OAuth flow: opens system browser, Tauri backend captures callback
  async startOAuth(provider: OAuthProvider): Promise<OAuthTokens> {
    const config = OAUTH_CONFIGS[provider];
    if (!config) throw new Error(`Unknown OAuth provider: ${provider}`);

    // Tauri backend handles: open browser, start localhost server, capture code, exchange for tokens
    const tokens = await invoke<OAuthTokens>('oauth_start', {
      provider,
      authUrl: config.authUrl,
      tokenUrl: config.tokenUrl,
      scope: config.scope,
      usePkce: config.usePKCE ?? false,
    });

    // Store tokens in OS keychain
    await this.storeTokens(provider, tokens);
    return tokens;
  }

  async refreshAccessToken(provider: OAuthProvider): Promise<OAuthTokens> {
    const tokens = await invoke<OAuthTokens>('oauth_refresh', { provider });
    await this.storeTokens(provider, tokens);
    return tokens;
  }

  async revokeTokens(provider: OAuthProvider): Promise<void> {
    await invoke('oauth_revoke', { provider });
    await invoke('delete_oauth_tokens', { provider });
  }

  async getTokens(provider: OAuthProvider): Promise<OAuthTokens | null> {
    try {
      return await invoke<OAuthTokens | null>('get_oauth_tokens', { provider });
    } catch {
      return null;
    }
  }

  async isConnected(provider: OAuthProvider): Promise<boolean> {
    const tokens = await this.getTokens(provider);
    return tokens !== null;
  }

  async getValidAccessToken(provider: OAuthProvider): Promise<string> {
    const tokens = await this.getTokens(provider);
    if (!tokens) throw new Error(`Not connected to ${provider}`);

    // Check if expired
    if (tokens.expiresAt && new Date(tokens.expiresAt) <= new Date()) {
      const refreshed = await this.refreshAccessToken(provider);
      return refreshed.accessToken;
    }

    return tokens.accessToken;
  }

  private async storeTokens(provider: OAuthProvider, tokens: OAuthTokens): Promise<void> {
    await invoke('store_oauth_tokens', { provider, tokens });
  }
}

export const oauthManager = new OAuthManager();
