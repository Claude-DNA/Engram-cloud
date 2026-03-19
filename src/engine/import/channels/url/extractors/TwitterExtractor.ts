import { invoke } from '@tauri-apps/api/core';
import type { UrlExtractionResult } from '../UrlChannel';

interface OEmbedResponse {
  ok: boolean;
  html?: string;
  error?: string;
}

export async function extractTwitter(url: string): Promise<UrlExtractionResult> {
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;

  try {
    const response = await invoke<OEmbedResponse>('url_fetch', { url: oembedUrl });

    if (!response.ok || !response.html) {
      return {
        url,
        sourceType: 'twitter_post',
        title: '',
        text: '',
        metadata: {},
        error: response.error || 'Failed to fetch tweet via oEmbed',
      };
    }

    // oEmbed returns JSON with html field containing the tweet
    const data = JSON.parse(response.html);
    const authorName = data.author_name || '';
    const authorUrl = data.author_url || '';

    // Extract clean text from the HTML embed
    // The html field contains <blockquote class="twitter-tweet"><p>...</p>
    let tweetText = '';
    const pMatch = data.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    if (pMatch) {
      tweetText = pMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    }

    // Extract date from the embed HTML
    const dateMatch = data.html?.match(
      /(\w+ \d+, \d{4})/,
    );
    const date = dateMatch ? dateMatch[1] : undefined;

    // Extract username from author_url
    const username = authorUrl.match(/twitter\.com\/(\w+)/)?.[1]
      || authorUrl.match(/x\.com\/(\w+)/)?.[1]
      || '';

    const fullText = `Tweet by @${username} (${authorName})${date ? ` on ${date}` : ''}:\n\n${tweetText}`;

    return {
      url,
      sourceType: 'twitter_post',
      title: `Tweet by @${username}`,
      author: `@${username} (${authorName})`,
      date,
      text: fullText,
      metadata: {
        username,
        authorName,
        authorUrl,
        oembedProvider: 'twitter',
      },
    };
  } catch (err) {
    return {
      url,
      sourceType: 'twitter_post',
      title: '',
      text: '',
      metadata: {},
      error: `Twitter extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
