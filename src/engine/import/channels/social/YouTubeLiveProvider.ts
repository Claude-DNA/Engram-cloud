// YouTubeLiveProvider.ts — YouTube Data API v3 live provider

import { invoke } from '@tauri-apps/api/core';
import { oauthManager } from '../cloud/OAuthManager';
import { RateLimiter } from './RateLimiter';
import type { SocialItem, SocialFetchResult, FetchOptions, SocialProfile } from '../SocialChannel';

export class YouTubeLiveProvider {
  readonly name = 'YouTube';
  private rateLimiter = new RateLimiter('youtube');
  private uploadsPlaylistId: string | null = null;

  async connect(): Promise<void> {
    await oauthManager.startOAuth('youtube');
  }

  async disconnect(): Promise<void> {
    await oauthManager.revokeTokens('youtube');
    this.uploadsPlaylistId = null;
  }

  async isConnected(): Promise<boolean> {
    return oauthManager.isConnected('youtube');
  }

  async getProfile(): Promise<SocialProfile> {
    const token = await oauthManager.getValidAccessToken('youtube');
    const response = await invoke<{
      items?: Array<{
        id: string;
        snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } };
        statistics?: { videoCount?: string; subscriberCount?: string };
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }>;
    }>('oauth_api_request', {
      url: 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true',
      token,
      method: 'GET',
    });

    const channel = response.items?.[0];
    if (!channel) throw new Error('No YouTube channel found');

    this.uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads ?? null;

    return {
      platform: 'youtube',
      id: channel.id,
      username: channel.snippet.customUrl ?? channel.snippet.title,
      displayName: channel.snippet.title,
      avatarUrl: channel.snippet.thumbnails?.default?.url,
      totalItems: parseInt(channel.statistics?.videoCount ?? '0'),
    };
  }

  async fetchHistory(options: FetchOptions = {}): Promise<SocialFetchResult> {
    if (!this.uploadsPlaylistId) {
      await this.getProfile();
    }
    if (!this.uploadsPlaylistId) throw new Error('Could not find uploads playlist');

    await this.rateLimiter.waitIfNeeded();

    const token = await oauthManager.getValidAccessToken('youtube');
    const maxResults = Math.min(options.maxItems ?? 50, 50);

    // Fetch playlist items
    const playlistResponse = await invoke<{
      items?: Array<{ snippet: { resourceId: { videoId: string } } }>;
      nextPageToken?: string;
    }>('oauth_api_request', {
      url: `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${this.uploadsPlaylistId}&maxResults=${maxResults}`,
      token,
      method: 'GET',
    });

    this.rateLimiter.consume();

    const videoIds = (playlistResponse.items ?? []).map((i) => i.snippet.resourceId.videoId);
    if (videoIds.length === 0) {
      return { items: [], hasMore: false, cursor: '', rateLimitRemaining: this.rateLimiter.remainingRequests, rateLimitResetAt: this.rateLimiter.resetAtDate.toISOString() };
    }

    // Fetch video details
    const videoResponse = await invoke<{
      items?: Array<{
        id: string;
        snippet: { title: string; description: string; publishedAt: string; channelTitle: string; tags?: string[] };
        contentDetails?: { duration: string };
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
      }>;
    }>('oauth_api_request', {
      url: `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}`,
      token,
      method: 'GET',
    });

    this.rateLimiter.consume();

    const items: SocialItem[] = (videoResponse.items ?? []).map((video) => ({
      platform: 'youtube',
      id: video.id,
      text: `${video.snippet.title}\n\n${video.snippet.description}`,
      createdAt: video.snippet.publishedAt,
      type: 'video' as const,
      engagement: {
        likes: parseInt(video.statistics?.likeCount ?? '0'),
        reposts: 0,
        replies: parseInt(video.statistics?.commentCount ?? '0'),
      },
      hashtags: video.snippet.tags?.slice(0, 20),
    }));

    return {
      items,
      hasMore: !!playlistResponse.nextPageToken,
      cursor: playlistResponse.nextPageToken ?? '',
      rateLimitRemaining: this.rateLimiter.remainingRequests,
      rateLimitResetAt: this.rateLimiter.resetAtDate.toISOString(),
    };
  }

  async fetchSince(lastSyncTimestamp: string): Promise<SocialFetchResult> {
    return this.fetchHistory({ startDate: lastSyncTimestamp });
  }
}

export const youtubeLiveProvider = new YouTubeLiveProvider();
