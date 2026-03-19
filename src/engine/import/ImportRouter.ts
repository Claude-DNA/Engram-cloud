import type { ImportSourceType } from './types';

/** WhatsApp export lines start with a date like "12/25/2020, 3:45 PM - " */
const WHATSAPP_DATE_PATTERN = /^\d{1,2}\/\d{1,2}\/\d{2,4}[,\s]/;

/**
 * Detect import source type from file name and (optionally) first-bytes content.
 * For zip files the detection relies on the internal file structure.
 */
export async function routeImport(file: File): Promise<ImportSourceType> {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop() ?? '';

  if (ext === 'zip') {
    return detectZipType(file);
  }

  if (ext === 'txt' || ext === 'md') {
    return detectTextType(file);
  }

  if (ext === 'pdf') return 'pdf';

  if (['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'webp', 'tiff', 'tif'].includes(ext)) {
    return 'photo';
  }

  if (ext === 'engram' || ext === 'json') return 'engram_backup';

  return 'unknown';
}

async function detectZipType(file: File): Promise<ImportSourceType> {
  try {
    // Lazy import to avoid bundle cost at startup
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files);

    // Twitter archive contains data/tweets.js or tweets.js
    if (names.some((n) => n.endsWith('tweets.js') || n.includes('tweet.js'))) {
      return 'twitter';
    }

    // Instagram archive contains content/posts_1.json or media/posts/
    if (
      names.some(
        (n) =>
          n.includes('posts_1.json') ||
          n.includes('your_posts') ||
          n.includes('instagram') ||
          n.includes('connections/followers'),
      )
    ) {
      return 'instagram';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

async function detectTextType(file: File): Promise<ImportSourceType> {
  try {
    // Read first 2 KB to detect format
    const slice = file.slice(0, 2048);
    const text = await slice.text();
    const firstLine = text.split('\n')[0] ?? '';

    if (WHATSAPP_DATE_PATTERN.test(firstLine.trim())) {
      return 'whatsapp';
    }
  } catch {
    // fall through
  }
  return 'text';
}
