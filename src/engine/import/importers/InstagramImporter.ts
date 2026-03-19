import JSZip from 'jszip';
import { chunkText } from '../ChunkManager';
import { generateUUIDv7 as generateId } from '../../../lib/uuid';
import type { ImportChunk } from '../types';

interface IgPost {
  timestamp: number;
  media?: Array<{
    uri: string;
    creation_timestamp: number;
    title?: string;
    media_metadata?: {
      photo_metadata?: { exif_data?: Array<{ longitude?: number; latitude?: number }> };
    };
  }>;
  title?: string;
}

interface IgPostsFile {
  ig_media_or_profile?: IgPost[];
}

function formatPost(post: IgPost): string {
  const date = new Date(post.timestamp * 1000).toISOString().split('T')[0];
  const caption = post.title ?? post.media?.[0]?.title ?? '(no caption)';

  // Collect any location tags from EXIF
  const locationParts: string[] = [];
  for (const m of post.media ?? []) {
    const exif = m.media_metadata?.photo_metadata?.exif_data;
    if (exif) {
      for (const e of exif) {
        if (e.latitude !== undefined && e.longitude !== undefined) {
          locationParts.push(`${e.latitude.toFixed(5)}, ${e.longitude.toFixed(5)}`);
        }
      }
    }
  }

  let text = `[${date}] ${caption}`;
  if (locationParts.length > 0) {
    text += `\nLocation: ${locationParts.join('; ')}`;
  }
  return text;
}

export async function parse(file: File, jobId: string): Promise<ImportChunk[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Instagram archive: content/posts_1.json or your_posts/media.json variants
  const postsFile =
    zip.file('content/posts_1.json') ??
    zip.file('your_posts_1.json') ??
    Object.values(zip.files).find(
      (f) => f.name.endsWith('posts_1.json') || f.name.includes('your_posts'),
    );

  if (!postsFile) return [];

  const raw = await postsFile.async('string');
  let posts: IgPost[] = [];

  try {
    const data = JSON.parse(raw) as IgPost[] | IgPostsFile;
    posts = Array.isArray(data) ? data : (data.ig_media_or_profile ?? []);
  } catch {
    return [];
  }

  // Sort chronologically
  posts.sort((a, b) => a.timestamp - b.timestamp);

  const text = posts.map(formatPost).join('\n\n');
  const subChunks = chunkText(text, jobId, false);

  return subChunks.map((c, i) => ({
    ...c,
    id: generateId(),
    index: i,
    metadata: { source: 'instagram' },
  }));
}
