// InstagramLiveProvider.ts — Instagram Graph API live provider

import { invoke } from '@tauri-apps/api/core';
import { oauthManager } from '../cloud/OAuthManager';
import { RateLimiter } from './RateLimiter';
import type { SocialItem, SocialFetchResult, FetchOptions, SocialProfile } from '../SocialChannel';

export class InstagramLiveProvider {
  readonly name = 'Instagram';
  private rateLimiter = new RateLimiter('instagram');
  private userId: string | null = null;

  async connect(): Promise<void> {
    await oauthManager.startOAuth('instagram');
  }

  async disconnect(): Promise<void> {
    await oauthManager.revokeTokens('instagram');
    this.userId = null;
  }

  async isConnected(): Promise<boolean> {
    return oauthManager.isConnected('instagram');
  }

  async getProfile(): Promise<SocialProfile> {
    const token = await oauthManager.getValidAccessToken('instagram');
    const response = await invoke<{ id: string; username: string; media_count?: number }>('oauth_api_request', {
      url: `https://graph.instagram.com/me?fields=id,username,media_count&access_token=${token}`,
      token,
      method: 'GET',
    });

    this.userId = response.id;
    return {
      platform: 'instagram',
      id: response.id,
      username: response.username,
      displayName: response.username,
      totalItems: response.media_count ?? 0,
    };
  }

  async fetchHistory(options: FetchOptions = {}): Promise<SocialFetchResult> {
    if (!this.userId) {
      const profile = await this.getProfile();
      this.userId = profile.id;
    }

    await this.rateLimiter.waitIfNeeded();

    const token = await oauthManager.getValidAccessToken('instagram');
    const limit = Math.min(options.maxItems ?? 50, 50);

    const response = await invoke<{
      data?: Array<{
        id: string; caption?: string; timestamp: string;
        media_type: string; permalink: string; thumbnail_url?: string;
      }>;
      paging?: { cursors?: { after?: string }; next?: string };
    }>('oauth_api_request', {
      url: `https://graph.instagram.com/${this.userId}/media?fields=id,caption,timestamp,media_type,permalink,thumbnail_url&limit=${limit}&access_token=${token}`,
      token,
      method: 'GET',
    });

    this.rateLimiter.consume();

    const items: SocialItem[] = (response.data ?? []).map((post) => ({
      platform: 'instagram',
      id: post.id,
      text: post.caption ?? '',
      createdAt: post.timestamp,
      type: 'post' as const,
      engagement: { likes: 0, reposts: 0, replies: 0 },
      media: post.thumbnail_url ? [{ type: post.media_type, url: post.thumbnail_url }] : undefined,
    }));

    const cursor = response.paging?.cursors?.after ?? '';

    return {
      items,
      hasMore: !!response.paging?.next,
      cursor,
      rateLimitRemaining: this.rateLimiter.remainingRequests,
      rateLimitResetAt: this.rateLimiter.resetAtDate.toISOString(),
    };
  }

  async fetchSince(lastSyncTimestamp: string): Promise<SocialFetchResult> {
    return this.fetchHistory({ startDate: lastSyncTimestamp });
  }
}

export const instagramLiveProvider = new InstagramLiveProvider();
