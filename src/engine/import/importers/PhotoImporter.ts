import { generateUUIDv7 as generateId } from '../../../lib/uuid';
import type { ImportChunk } from '../types';

interface ExifData {
  DateTimeOriginal?: Date | string;
  CreateDate?: Date | string;
  GPSLatitude?: number;
  GPSLongitude?: number;
  Make?: string;
  Model?: string;
  ImageDescription?: string;
  UserComment?: string;
  Artist?: string;
  Software?: string;
  [key: string]: unknown;
}

async function readExif(file: File): Promise<ExifData | null> {
  try {
    const exifr = await import('exifr');
    const data = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      icc: false,
      iptc: false,
    }) as ExifData | null;
    return data;
  } catch {
    return null;
  }
}

function formatExifSummary(exif: ExifData, fileName: string): string {
  const lines: string[] = [`Photo: ${fileName}`];

  const date = exif.DateTimeOriginal ?? exif.CreateDate;
  if (date) {
    const d = date instanceof Date ? date.toISOString().split('T')[0] : String(date).substring(0, 10);
    lines.push(`Date taken: ${d}`);
  }

  if (exif.GPSLatitude !== undefined && exif.GPSLongitude !== undefined) {
    lines.push(`GPS: ${exif.GPSLatitude.toFixed(6)}, ${exif.GPSLongitude.toFixed(6)}`);
  }

  if (exif.Make || exif.Model) {
    lines.push(`Camera: ${[exif.Make, exif.Model].filter(Boolean).join(' ')}`);
  }

  if (exif.ImageDescription) {
    lines.push(`Description: ${exif.ImageDescription}`);
  }

  if (exif.UserComment && exif.UserComment !== exif.ImageDescription) {
    lines.push(`Comment: ${exif.UserComment}`);
  }

  if (exif.Artist) {
    lines.push(`Artist: ${exif.Artist}`);
  }

  return lines.join('\n');
}

export async function parse(file: File, jobId: string): Promise<ImportChunk[]> {
  const exif = await readExif(file);

  const text = exif
    ? formatExifSummary(exif, file.name)
    : `Photo: ${file.name}\n(No EXIF metadata found)`;

  const chunk: ImportChunk = {
    id: generateId(),
    jobId,
    index: 0,
    text,
    tokenEstimate: Math.ceil(text.split(/\s+/).length * 1.3),
    startOffset: 0,
    endOffset: text.length,
    metadata: {
      source: 'photo',
      fileName: file.name,
      fileSize: file.size,
      exif: exif ?? undefined,
    },
  };

  return [chunk];
}
