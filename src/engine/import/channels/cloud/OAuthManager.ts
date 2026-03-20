// OAuthManager.ts — manages OAuth flows for cloud/social providers
// Uses Apple's ASWebAuthenticationSession via Tauri backend for native auth

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
  callbackScheme: string;
}

// Custom URL scheme for OAuth callbacks: engram-cloud://oauth/{provider}
const CALLBACK_SCHEME = 'engram-cloud';

const OAUTH_CONFIGS: Record<string, Partial<OAuthConfig>> = {
  google_drive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    usePKCE: false,
    callbackScheme: CALLBACK_SCHEME,
  },
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scope: '',
    usePKCE: true,
    callbackScheme: CALLBACK_SCHEME,
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scope: 'tweet.read users.read offline.access',
    usePKCE: true,
    callbackScheme: CALLBACK_SCHEME,
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scope: 'instagram_basic',
    usePKCE: false,
    callbackScheme: CALLBACK_SCHEME,
  },
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    usePKCE: false,
    callbackScheme: CALLBACK_SCHEME,
  },
};

export class OAuthManager {
  /**
   * Start OAuth flow using Apple's ASWebAuthenticationSession.
   * 
   * The Rust backend:
   * 1. Generates PKCE code_verifier + code_challenge (if needed)
   * 2. Builds the auth URL with redirect_uri = engram-cloud://oauth/{provider}
   * 3. Opens ASWebAuthenticationSession (native macOS/iOS auth sheet)
   * 4. User authenticates in system browser
   * 5. Provider redirects to engram-cloud://oauth/{provider}?code=...
   * 6. ASWebAuthenticationSession captures the callback
   * 7. Rust exchanges code for tokens via tokenUrl
   * 8. Tokens stored in macOS Keychain automatically
   * 9. Returns tokens to frontend
   */
  async startOAuth(provider: OAuthProvider): Promise<OAuthTokens> {
    const config = OAUTH_CONFIGS[provider];
    if (!config) throw new Error(`Unknown OAuth provider: ${provider}`);

    const tokens = await invoke<OAuthTokens>('oauth_native_auth', {
      provider,
      authUrl: config.authUrl,
      tokenUrl: config.tokenUrl,
      scope: config.scope,
      usePkce: config.usePKCE ?? false,
      callbackScheme: config.callbackScheme ?? CALLBACK_SCHEME,
    });

    return tokens;
  }

  async refreshAccessToken(provider: OAuthProvider): Promise<OAuthTokens> {
    const config = OAUTH_CONFIGS[provider];
    if (!config) throw new Error(`Unknown OAuth provider: ${provider}`);

    const tokens = await invoke<OAuthTokens>('oauth_refresh_token', {
      provider,
      tokenUrl: config.tokenUrl,
    });
    return tokens;
  }

  async revokeTokens(provider: OAuthProvider): Promise<void> {
    await invoke('oauth_revoke', { provider });
  }

  async getTokens(provider: OAuthProvider): Promise<OAuthTokens | null> {
    try {
      return await invoke<OAuthTokens | null>('oauth_get_tokens', { provider });
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

    // Check if expired — refresh automatically
    if (tokens.expiresAt && new Date(tokens.expiresAt) <= new Date()) {
      const refreshed = await this.refreshAccessToken(provider);
      return refreshed.accessToken;
    }

    return tokens.accessToken;
  }

  /**
   * Disconnect a provider: revoke tokens + remove from Keychain
   */
  async disconnect(provider: OAuthProvider): Promise<void> {
    await this.revokeTokens(provider);
  }

  /**
   * Get all connected providers
   */
  async getConnectedProviders(): Promise<OAuthProvider[]> {
    const providers: OAuthProvider[] = ['google_drive', 'dropbox', 'twitter', 'instagram', 'youtube'];
    const connected: OAuthProvider[] = [];
    for (const p of providers) {
      if (await this.isConnected(p)) connected.push(p);
    }
    return connected;
  }
}

export const oauthManager = new OAuthManager();
