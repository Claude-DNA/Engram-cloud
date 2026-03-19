import JSZip from 'jszip';
import { chunkText } from '../ChunkManager';
import { generateUUIDv7 as generateId } from '../../../lib/uuid';
import type { ImportChunk } from '../types';

interface Tweet {
  tweet: {
    id_str: string;
    full_text: string;
    created_at: string;
    in_reply_to_user_id_str?: string;
    retweeted_status?: unknown;
    entities?: {
      hashtags?: Array<{ text: string }>;
      user_mentions?: Array<{ screen_name: string }>;
    };
  };
}

/** Parse a tweets.js file: "window.YTD.tweets.part0 = [...]" */
function parseTweetsJs(content: string): Tweet[] {
  const match = /=\s*(\[[\s\S]*\])/.exec(content);
  if (!match) return [];
  try {
    return JSON.parse(match[1]) as Tweet[];
  } catch {
    return [];
  }
}

/** Group consecutive self-reply tweets into threads */
function groupIntoThreads(tweets: Tweet[]): Tweet[][] {
  const threads: Tweet[][] = [];
  let currentThread: Tweet[] = [];

  for (const t of tweets) {
    const isReply = !!t.tweet.in_reply_to_user_id_str;
    if (currentThread.length === 0) {
      currentThread.push(t);
    } else if (isReply) {
      currentThread.push(t);
    } else {
      if (currentThread.length > 0) threads.push(currentThread);
      currentThread = [t];
    }
  }
  if (currentThread.length > 0) threads.push(currentThread);
  return threads;
}

/** Format a thread of tweets as a readable text block */
function threadToText(thread: Tweet[]): string {
  return thread
    .map((t) => {
      const date = new Date(t.tweet.created_at).toISOString().split('T')[0];
      return `[${date}] ${t.tweet.full_text}`;
    })
    .join('\n\n');
}

export async function parse(file: File, jobId: string): Promise<ImportChunk[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Find tweets.js — may be at data/tweets.js or tweets.js
  const tweetsFile =
    zip.file('data/tweets.js') ??
    zip.file('tweets.js') ??
    Object.values(zip.files).find((f) => f.name.endsWith('tweets.js'));

  if (!tweetsFile) return [];

  const content = await tweetsFile.async('string');
  const allTweets = parseTweetsJs(content);

  // Filter out retweets
  const ownTweets = allTweets.filter((t) => !t.tweet.retweeted_status);

  // Sort chronologically
  ownTweets.sort(
    (a, b) =>
      new Date(a.tweet.created_at).getTime() - new Date(b.tweet.created_at).getTime(),
  );

  const threads = groupIntoThreads(ownTweets);

  // Group threads by month to keep related content together
  const monthBuckets = new Map<string, Tweet[][]>();
  for (const thread of threads) {
    const date = new Date(thread[0].tweet.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthBuckets.has(key)) monthBuckets.set(key, []);
    monthBuckets.get(key)!.push(thread);
  }

  const chunks: ImportChunk[] = [];
  let chunkIndex = 0;

  for (const [month, monthThreads] of monthBuckets) {
    const text = monthThreads.map(threadToText).join('\n\n---\n\n');
    const subChunks = chunkText(text, jobId, true);
    for (const c of subChunks) {
      chunks.push({
        ...c,
        id: generateId(),
        index: chunkIndex++,
        metadata: { source: 'twitter', month },
      });
    }
  }

  return chunks;
}
