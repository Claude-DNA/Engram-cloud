import { invoke } from '@tauri-apps/api/core';
import { detectUrlType, type UrlSourceType } from './url/UrlTypeDetector';
import { extractTwitter } from './url/extractors/TwitterExtractor';
import { extractYouTube } from './url/extractors/YouTubeExtractor';
import { extractReddit } from './url/extractors/RedditExtractor';
import { extractArticle } from './url/extractors/ArticleExtractor';
import { extractInstagram } from './url/extractors/InstagramExtractor';
import type { ImportChunk } from '../types';
import { generateUUIDv7 as generateId } from '../../../lib/uuid';

export interface UrlExtractionResult {
  url: string;
  sourceType: UrlSourceType;
  title: string;
  author?: string;
  date?: string;
  text: string;
  metadata: Record<string, unknown>;
  error?: string;
}

interface FetchResponse {
  ok: boolean;
  html?: string;
  content_type?: string;
  final_url?: string;
  error?: string;
}

async function fetchUrl(url: string): Promise<FetchResponse> {
  return await invoke<FetchResponse>('url_fetch', { url });
}

export async function extractFromUrl(url: string): Promise<UrlExtractionResult> {
  const sourceType = detectUrlType(url);

  try {
    switch (sourceType) {
      case 'twitter_post':
        return await extractTwitter(url);
      case 'youtube_video':
        return await extractYouTube(url);
      case 'reddit_post':
        return await extractReddit(url, fetchUrl);
      case 'instagram_post':
        return await extractInstagram(url);
      default: {
        // Generic article/web page extraction
        const response = await fetchUrl(url);
        if (!response.ok || !response.html) {
          return {
            url,
            sourceType,
            title: '',
            text: '',
            metadata: {},
            error: response.error || 'Failed to fetch URL',
          };
        }
        return extractArticle(url, response.html, sourceType);
      }
    }
  } catch (err) {
    return {
      url,
      sourceType,
      title: '',
      text: '',
      metadata: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function extractionToChunks(
  result: UrlExtractionResult,
  jobId: string,
): ImportChunk[] {
  if (result.error || !result.text) return [];

  return [
    {
      id: generateId(),
      jobId,
      sourceType: result.sourceType === 'twitter_post' ? 'twitter' : 'text',
      content: result.text,
      timestamp: result.date || new Date().toISOString(),
      metadata: {
        url: result.url,
        title: result.title,
        author: result.author,
        extractedFrom: result.sourceType,
        ...result.metadata,
      },
    },
  ];
}
