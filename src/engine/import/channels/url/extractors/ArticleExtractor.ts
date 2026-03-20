import type { UrlExtractionResult } from '../../UrlChannel';
import type { UrlSourceType } from '../UrlTypeDetector';

/**
 * Generic article/web page extractor.
 * Uses a simplified Readability-like approach to extract clean text from HTML.
 * No external dependencies — pure string processing.
 */

function extractOgMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const regex = /<meta\s+(?:property|name)="(og:[^"]*|article:[^"]*|author|description)"\s+content="([^"]*)"/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    meta[match[1]] = match[2]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  return meta;
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match
    ? match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
    : '';
}

function htmlToText(html: string): string {
  // Remove script and style elements
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '');

  // Try to find the main content area
  const articleMatch = text.match(/<article[\s\S]*?<\/article>/i)
    || text.match(/<main[\s\S]*?<\/main>/i)
    || text.match(/<div[^>]*class="[^"]*(?:content|article|post|entry|story)[^"]*"[\s\S]*?<\/div>/i);

  if (articleMatch) {
    text = articleMatch[0];
  }

  // Convert block elements to newlines
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/blockquote>/gi, '\n');

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code)));

  // Clean up whitespace
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

export function extractArticle(
  url: string,
  html: string,
  sourceType: UrlSourceType,
): UrlExtractionResult {
  const og = extractOgMeta(html);
  const title = og['og:title'] || extractTitle(html);
  const author = og['og:author'] || og['author'] || '';
  const date = og['article:published_time'] || og['og:updated_time'] || '';
  const description = og['og:description'] || og['description'] || '';

  const bodyText = htmlToText(html);

  // If body is too short, it might be a JS-rendered SPA
  if (bodyText.length < 50) {
    return {
      url,
      sourceType,
      title,
      text: description || '',
      metadata: { ...og, extractionMethod: 'og_only' },
      error: bodyText.length === 0
        ? 'Not enough content found. This might be behind a login wall or require JavaScript.'
        : undefined,
    };
  }

  const parts: string[] = [];
  if (title) parts.push(title);
  if (author) parts.push(`By: ${author}`);
  if (date) parts.push(`Published: ${date}`);
  parts.push(`Source: ${url}`);
  parts.push('');
  parts.push(bodyText);

  return {
    url,
    sourceType,
    title,
    author,
    date,
    text: parts.join('\n'),
    metadata: {
      ...og,
      extractionMethod: 'readability',
      bodyLength: bodyText.length,
    },
  };
}
