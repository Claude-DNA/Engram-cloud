import type { UrlExtractionResult } from '../UrlChannel';

interface FetchResponse {
  ok: boolean;
  html?: string;
  error?: string;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

export async function extractReddit(
  url: string,
  fetchUrl: FetchFn,
): Promise<UrlExtractionResult> {
  try {
    // Reddit's JSON API: append .json to any Reddit URL
    let jsonUrl = url.replace(/\/?$/, '.json');
    // Remove query params for clean JSON fetch
    const u = new URL(jsonUrl);
    u.searchParams.set('limit', '10'); // top 10 comments
    jsonUrl = u.toString();

    const response = await fetchUrl(jsonUrl);
    if (!response.ok || !response.html) {
      return {
        url,
        sourceType: 'reddit_post',
        title: '',
        text: '',
        metadata: {},
        error: response.error || 'Failed to fetch Reddit post',
      };
    }

    const data = JSON.parse(response.html);

    // Reddit returns an array: [0] = post listing, [1] = comments listing
    const postData = data[0]?.data?.children?.[0]?.data;
    if (!postData) {
      return {
        url,
        sourceType: 'reddit_post',
        title: '',
        text: '',
        metadata: {},
        error: 'Could not parse Reddit post data',
      };
    }

    const title = postData.title || '';
    const author = postData.author || '[deleted]';
    const subreddit = postData.subreddit_name_prefixed || '';
    const selftext = postData.selftext || '';
    const score = postData.score || 0;
    const created = postData.created_utc
      ? new Date(postData.created_utc * 1000).toISOString()
      : undefined;

    // Extract top comments
    const comments: string[] = [];
    const commentListing = data[1]?.data?.children || [];
    for (const child of commentListing.slice(0, 10)) {
      if (child.kind !== 't1') continue;
      const c = child.data;
      if (!c || c.author === 'AutoModerator') continue;
      const body = (c.body || '').slice(0, 500); // Truncate long comments
      comments.push(`u/${c.author} (${c.score || 0} pts): ${body}`);
    }

    const parts: string[] = [];
    parts.push(`Reddit Post in ${subreddit}`);
    parts.push(`Title: ${title}`);
    parts.push(`Author: u/${author} | Score: ${score}`);
    if (created) parts.push(`Posted: ${created}`);
    parts.push('');
    if (selftext) {
      parts.push(selftext);
      parts.push('');
    }
    if (comments.length > 0) {
      parts.push('--- Top Comments ---');
      comments.forEach((c) => parts.push(`• ${c}`));
    }

    return {
      url,
      sourceType: 'reddit_post',
      title,
      author: `u/${author}`,
      date: created,
      text: parts.join('\n'),
      metadata: {
        subreddit,
        score,
        commentCount: comments.length,
      },
    };
  } catch (err) {
    return {
      url,
      sourceType: 'reddit_post',
      title: '',
      text: '',
      metadata: {},
      error: `Reddit extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
