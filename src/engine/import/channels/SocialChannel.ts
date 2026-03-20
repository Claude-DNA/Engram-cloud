// SocialChannel.ts — social channel orchestrator

import { generateUUIDv7 as generateId } from '../../../lib/uuid';
import type { ImportChunk } from '../types';
import { twitterLiveProvider } from './social/TwitterLiveProvider';
import { instagramLiveProvider } from './social/InstagramLiveProvider';
import { youtubeLiveProvider } from './social/YouTubeLiveProvider';
import { syncManager } from './social/SocialSyncManager';

export type SocialPlatform = 'twitter' | 'instagram' | 'youtube';

export interface SocialProfile {
  platform: string;
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  totalItems: number;
}

export interface SocialItem {
  platform: string;
  id: string;
  text: string;
  createdAt: string;
  type: 'post' | 'reply' | 'repost' | 'story' | 'video';
  engagement: { likes: number; reposts: number; replies: number };
  media?: { type: string; url: string }[];
  replyTo?: string;
  threadId?: string;
  location?: string;
  hashtags?: string[];
  mentions?: string[];
}

export interface FetchOptions {
  startDate?: string;
  endDate?: string;
  maxItems?: number;
  includeReplies?: boolean;
  includeReposts?: boolean;
}

export interface SocialFetchResult {
  items: SocialItem[];
  hasMore: boolean;
  cursor: string;
  rateLimitRemaining: number;
  rateLimitResetAt: string;
}

export interface SocialProvider {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  getProfile(): Promise<SocialProfile>;
  fetchHistory(options?: FetchOptions): Promise<SocialFetchResult>;
  fetchSince(lastSyncTimestamp: string): Promise<SocialFetchResult>;
}

export function getSocialProvider(platform: SocialPlatform): SocialProvider {
  switch (platform) {
    case 'twitter': return twitterLiveProvider;
    case 'instagram': return instagramLiveProvider;
    case 'youtube': return youtubeLiveProvider;
    default: throw new Error(`Unknown social platform: ${platform}`);
  }
}

const estimateTokens = (text: string): number =>
  Math.ceil(text.split(/\s+/).length * 1.3);

export function socialItemsToChunks(
  items: SocialItem[],
  jobId: string,
): ImportChunk[] {
  return items
    .filter((item) => item.text.trim().length > 0)
    .map((item, index) => ({
      id: generateId(),
      jobId,
      index,
      text: item.text,
      tokenEstimate: estimateTokens(item.text),
      startOffset: 0,
      endOffset: item.text.length,
      metadata: {
        source: 'social_account',
        platform: item.platform,
        postId: item.id,
        postType: item.type,
        createdAt: item.createdAt,
        engagement: item.engagement,
        hashtags: item.hashtags,
        mentions: item.mentions,
        threadId: item.threadId,
      },
    }));
}

export interface SyncProgress {
  platform: string;
  itemsFetched: number;
  estimatedTotal: number;
  percentage: number;
  rateLimitRemaining: number;
  rateLimitResetAt: string;
  isPaused: boolean;
  isComplete: boolean;
}

export async function runSocialSync(
  platform: SocialPlatform,
  options: FetchOptions = {},
  onProgress?: (progress: SyncProgress) => void,
  shouldPause?: () => boolean,
): Promise<SocialItem[]> {
  const provider = getSocialProvider(platform);
  const allItems: SocialItem[] = [];

  await syncManager.markSyncing(platform);

  const state = await syncManager.loadState(platform);
  let cursor = state.lastCursor;
  let hasMore = true;

  try {
    const profile = await provider.getProfile();
    const estimatedTotal = profile.totalItems;

    while (hasMore) {
      if (shouldPause?.()) {
        await syncManager.markPaused(platform);
        onProgress?.({
          platform, itemsFetched: allItems.length, estimatedTotal,
          percentage: estimatedTotal > 0 ? (allItems.length / estimatedTotal) * 100 : 0,
          rateLimitRemaining: 0, rateLimitResetAt: '', isPaused: true, isComplete: false,
        });
        break;
      }

      const result = state.lastSyncAt && !options.startDate
        ? await provider.fetchSince(state.lastSyncAt)
        : await provider.fetchHistory({ ...options, maxItems: 100 });

      allItems.push(...result.items);
      cursor = result.cursor;
      hasMore = result.hasMore;

      onProgress?.({
        platform, itemsFetched: allItems.length, estimatedTotal,
        percentage: estimatedTotal > 0 ? (allItems.length / estimatedTotal) * 100 : 0,
        rateLimitRemaining: result.rateLimitRemaining,
        rateLimitResetAt: result.rateLimitResetAt,
        isPaused: false, isComplete: !hasMore,
      });

      // Brief pause between batches
      if (hasMore) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    await syncManager.markComplete(platform, cursor, allItems.length);
  } catch (err) {
    await syncManager.markError(platform, err instanceof Error ? err.message : String(err));
    throw err;
  }

  return allItems;
}
