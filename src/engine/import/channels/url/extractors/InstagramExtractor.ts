import { invoke } from '@tauri-apps/api/core';
import type { UrlExtractionResult } from '../UrlChannel';

interface FetchResponse {
  ok: boolean;
  html?: string;
  error?: string;
}

export async function extractInstagram(url: string): Promise<UrlExtractionResult> {
  try {
    // Try oEmbed first
    const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`;
    const response = await invoke<FetchResponse>('url_fetch', { url: oembedUrl });

    if (response.ok && response.html) {
      try {
        const data = JSON.parse(response.html);
        const author = data.author_name || '';
        const title = data.title || '';

        // oEmbed gives limited data but reliable
        const text = [
          `Instagram Post by @${author}`,
          '',
          title || '(no caption)',
        ].join('\n');

        return {
          url,
          sourceType: 'instagram_post',
          title: `Post by @${author}`,
          author: `@${author}`,
          text,
          metadata: {
            authorName: author,
            oembedProvider: 'instagram',
          },
        };
      } catch { /* parse failed, try fallback */ }
    }

    // Fallback: fetch the page and extract Open Graph tags
    const pageRes = await invoke<FetchResponse>('url_fetch', { url });
    if (!pageRes.ok || !pageRes.html) {
      return {
        url,
        sourceType: 'instagram_post',
        title: '',
        text: '',
        metadata: {},
        error: 'This content appears to be private or behind a login wall.',
      };
    }

    const html = pageRes.html;
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/)
      ?.[1]?.replace(/&amp;/g, '&').replace(/&#39;/g, "'") || '';
    const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/)
      ?.[1]?.replace(/&amp;/g, '&').replace(/&#39;/g, "'") || '';

    if (!ogTitle && !ogDesc) {
      return {
        url,
        sourceType: 'instagram_post',
        title: '',
        text: '',
        metadata: {},
        error: 'Not enough content found. This might be behind a login wall.',
      };
    }

    return {
      url,
      sourceType: 'instagram_post',
      title: ogTitle,
      text: [ogTitle, '', ogDesc].join('\n'),
      metadata: {
        extractedFrom: 'og_tags',
      },
    };
  } catch (err) {
    return {
      url,
      sourceType: 'instagram_post',
      title: '',
      text: '',
      metadata: {},
      error: `Instagram extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
