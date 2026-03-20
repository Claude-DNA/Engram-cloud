import { invoke } from '@tauri-apps/api/core';
import type { UrlExtractionResult } from '../../UrlChannel';

interface FetchResponse {
  ok: boolean;
  html?: string;
  error?: string;
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.slice(1);
    }
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

export async function extractYouTube(url: string): Promise<UrlExtractionResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    return {
      url,
      sourceType: 'youtube_video',
      title: '',
      text: '',
      metadata: {},
      error: 'Could not extract video ID from URL',
    };
  }

  try {
    // Fetch oEmbed for basic metadata
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const oembedRes = await invoke<FetchResponse>('url_fetch', { url: oembedUrl });

    let title = '';
    let author = '';
    if (oembedRes.ok && oembedRes.html) {
      try {
        const data = JSON.parse(oembedRes.html);
        title = data.title || '';
        author = data.author_name || '';
      } catch { /* ignore parse errors */ }
    }

    // Try to fetch transcript/captions
    let transcript = '';
    try {
      // Fetch the video page to find caption track URL
      const pageRes = await invoke<FetchResponse>('url_fetch', {
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });

      if (pageRes.ok && pageRes.html) {
        // Look for captions URL in the page source
        const captionMatch = pageRes.html.match(
          /"captionTracks":\s*\[(.*?)\]/,
        );
        if (captionMatch) {
          // Extract first caption track URL
          const urlMatch = captionMatch[1].match(
            /"baseUrl":\s*"([^"]+)"/,
          );
          if (urlMatch) {
            const captionUrl = urlMatch[1]
              .replace(/\\u0026/g, '&')
              .replace(/\\/g, '');

            const captionRes = await invoke<FetchResponse>('url_fetch', {
              url: captionUrl,
            });

            if (captionRes.ok && captionRes.html) {
              // Parse XML captions → plain text
              transcript = captionRes.html
                .replace(/<\?xml[^>]*>/g, '')
                .replace(/<text[^>]*>/g, '')
                .replace(/<\/text>/g, '\n')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/<[^>]+>/g, '')
                .trim();
            }
          }
        }

        // If no captions found, try to extract description
        if (!transcript) {
          const descMatch = pageRes.html.match(
            /"shortDescription":\s*"((?:[^"\\]|\\.)*)"/,
          );
          if (descMatch) {
            transcript = descMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
          }
        }
      }
    } catch {
      // Transcript extraction is best-effort
    }

    const parts: string[] = [];
    parts.push(`YouTube Video: ${title || 'Unknown Title'}`);
    if (author) parts.push(`Channel: ${author}`);
    parts.push(`URL: ${url}`);
    if (transcript) {
      parts.push('');
      parts.push('--- Transcript ---');
      parts.push(transcript);
    }

    return {
      url,
      sourceType: 'youtube_video',
      title: title || `YouTube Video ${videoId}`,
      author,
      text: parts.join('\n'),
      metadata: {
        videoId,
        hasTranscript: !!transcript,
        transcriptLength: transcript.length,
      },
    };
  } catch (err) {
    return {
      url,
      sourceType: 'youtube_video',
      title: '',
      text: '',
      metadata: { videoId },
      error: `YouTube extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
