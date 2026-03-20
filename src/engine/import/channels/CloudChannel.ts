// CloudChannel.ts — Cloud storage channel orchestrator

import { generateUUIDv7 as generateId } from '../../../lib/uuid';
import type { ImportChunk } from '../types';
import { driveProvider } from './cloud/DriveProvider';
import { dropboxProvider } from './cloud/DropboxProvider';
import { icloudProvider } from './cloud/ICloudProvider';
import type { CloudFile } from './cloud/DriveProvider';

export type CloudProviderType = 'google_drive' | 'dropbox' | 'icloud';

export function getCloudProvider(type: CloudProviderType) {
  switch (type) {
    case 'google_drive': return driveProvider;
    case 'dropbox': return dropboxProvider;
    case 'icloud': return icloudProvider;
    default: throw new Error(`Unknown cloud provider: ${type}`);
  }
}

export interface CloudDownloadResult {
  file: CloudFile;
  localPath: string; // temp file path after download
  provider: CloudProviderType;
}

export async function downloadCloudFiles(
  provider: CloudProviderType,
  files: CloudFile[],
  onProgress?: (current: number, total: number) => void,
): Promise<CloudDownloadResult[]> {
  const results: CloudDownloadResult[] = [];
  const p = getCloudProvider(provider);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.isFolder) continue;

    const localPath = await p.downloadFile(
      provider === 'dropbox' ? file.path : file.id,
      ...(provider === 'google_drive' ? [file.mimeType] : []),
    );

    results.push({ file, localPath, provider });
    onProgress?.(i + 1, files.length);
  }

  return results;
}

const estimateTokens = (text: string): number =>
  Math.ceil(text.split(/\s+/).length * 1.3);

export function cloudFileToChunks(
  text: string,
  file: CloudFile,
  provider: CloudProviderType,
  jobId: string,
): ImportChunk[] {
  if (!text || text.trim().length === 0) return [];

  return [{
    id: generateId(),
    jobId,
    index: 0,
    text,
    tokenEstimate: estimateTokens(text),
    startOffset: 0,
    endOffset: text.length,
    metadata: {
      source: 'cloud_storage',
      provider,
      fileName: file.name,
      mimeType: file.mimeType,
      fileSize: file.size,
      modifiedDate: file.modifiedDate,
      cloudFileId: file.id,
    },
  }];
}
