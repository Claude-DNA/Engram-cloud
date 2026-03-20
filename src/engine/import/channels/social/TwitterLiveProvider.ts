// TwitterLiveProvider.ts — Twitter/X API v2 live account provider

import { invoke } from '@tauri-apps/api/core';
import { oauthManager } from '../cloud/OAuthManager';
import { RateLimiter } from './RateLimiter';
import { syncManager } from './SocialSyncManager';
import type { SocialItem, SocialFetchResult, FetchOptions, SocialProfile } from '../SocialChannel';

export class TwitterLiveProvider {
  readonly name = 'Twitter/X';
  private rateLimiter = new RateLimiter('twitter');
  private userId: string | null = null;

  async connect(): Promise<void> {
    await oauthManager.startOAuth('twitter');
  }

  async disconnect(): Promise<void> {
    await oauthManager.revokeTokens('twitter');
    this.userId = null;
  }

  async isConnected(): Promise<boolean> {
    return oauthManager.isConnected('twitter');
  }

  async getProfile(): Promise<SocialProfile> {
    const token = await oauthManager.getValidAccessToken('twitter');
    const response = await invoke<{ data: { id: string; name: string; username: string; profile_image_url?: string; public_metrics?: { tweet_count: number; followers_count: number } } }>('oauth_api_request', {
      url: 'https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics',
      token,
      method: 'GET',
    });

    this.userId = response.data.id;
    return {
      platform: 'twitter',
      id: response.data.id,
      username: response.data.username,
      displayName: response.data.name,
      avatarUrl: response.data.profile_image_url,
      totalItems: response.data.public_metrics?.tweet_count ?? 0,
    };
  }

  async fetchHistory(options: FetchOptions = {}): Promise<SocialFetchResult> {
    if (!this.userId) {
      const profile = await this.getProfile();
      this.userId = profile.id;
    }

    const state = await syncManager.loadState('twitter');

    await this.rateLimiter.waitIfNeeded();

    const token = await oauthManager.getValidAccessToken('twitter');
    const params = new URLSearchParams({
      'max_results': String(Math.min(options.maxItems ?? 100, 100)),
      'tweet.fields': 'created_at,public_metrics,in_reply_to_user_id,entities,conversation_id',
      'expansions': 'attachments.media_keys',
      'media.fields': 'type,url,preview_image_url',
    });

    if (state.lastCursor && !options.startDate) {
      params.set('pagination_token', state.lastCursor);
    }
    if (options.startDate) {
      params.set('start_time', new Date(options.startDate).toISOString());
    }
    if (options.endDate) {
      params.set('end_time', new Date(options.endDate).toISOString());
    }
    if (options.includeReposts === false) {
      params.set('exclude', 'retweets');
    }

    const response = await invoke<{
      data?: Array<{
        id: string; text: string; created_at: string;
        public_metrics?: { like_count: number; retweet_count: number; reply_count: number };
        in_reply_to_user_id?: string; conversation_id?: string;
        entities?: { hashtags?: Array<{ tag: string }>; mentions?: Array<{ username: string }> };
      }>;
      meta?: { next_token?: string; result_count: number };
    }>('oauth_api_request', {
      url: `https://api.twitter.com/2/users/${this.userId}/tweets?${params}`,
      token,
      method: 'GET',
    });

    this.rateLimiter.consume();

    const items: SocialItem[] = (response.data ?? []).map((tweet) => ({
      platform: 'twitter',
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      type: tweet.in_reply_to_user_id ? 'reply' as const : 'post' as const,
      engagement: {
        likes: tweet.public_metrics?.like_count ?? 0,
        reposts: tweet.public_metrics?.retweet_count ?? 0,
        replies: tweet.public_metrics?.reply_count ?? 0,
      },
      threadId: tweet.conversation_id,
      hashtags: tweet.entities?.hashtags?.map((h) => h.tag),
      mentions: tweet.entities?.mentions?.map((m) => m.username),
    }));

    const cursor = response.meta?.next_token ?? '';

    return {
      items,
      hasMore: !!response.meta?.next_token,
      cursor,
      rateLimitRemaining: this.rateLimiter.remainingRequests,
      rateLimitResetAt: this.rateLimiter.resetAtDate.toISOString(),
    };
  }

  async fetchSince(lastSyncTimestamp: string): Promise<SocialFetchResult> {
    return this.fetchHistory({ startDate: lastSyncTimestamp });
  }
}

export const twitterLiveProvider = new TwitterLiveProvider();
