// ICloudProvider.ts — iCloud Drive integration (macOS only, via local filesystem)

import { invoke } from '@tauri-apps/api/core';
import type { CloudFile, StorageQuota } from './DriveProvider';

const ICLOUD_BASE = '~/Library/Mobile Documents/com~apple~CloudDocs';

export class ICloudProvider {
  readonly name = 'iCloud Drive';

  async isAvailable(): Promise<boolean> {
    return navigator.userAgent.includes('Mac');
  }

  async connect(): Promise<void> {
    // No OAuth needed — uses local filesystem access
    const available = await this.isAvailable();
    if (!available) throw new Error('iCloud Drive is only available on macOS');
  }

  async disconnect(): Promise<void> {
    // Nothing to revoke — just remove from settings
  }

  async isConnected(): Promise<boolean> {
    if (!await this.isAvailable()) return false;
    try {
      await invoke<boolean>('icloud_check_access', { basePath: ICLOUD_BASE });
      return true;
    } catch {
      return false;
    }
  }

  async getAccountInfo(): Promise<{ email: string; name: string; quota: StorageQuota }> {
    return {
      email: '',
      name: 'iCloud Drive (local access)',
      quota: { used: 0, total: 0 },
    };
  }

  async listFiles(path: string = ''): Promise<{ files: CloudFile[] }> {
    const fullPath = path || ICLOUD_BASE;
    const files = await invoke<Array<{
      name: string; path: string; is_dir: boolean;
      size: number; modified: string; mime_type: string;
    }>>('icloud_list_files', { path: fullPath });

    return {
      files: (files ?? []).map((f) => ({
        id: f.path,
        name: f.name,
        path: f.path,
        mimeType: f.mime_type,
        size: f.size,
        modifiedDate: f.modified,
        isFolder: f.is_dir,
      })),
    };
  }

  async downloadFile(filePath: string): Promise<string> {
    // Files are already local — just return the path for ImportRouter
    return filePath;
  }
}

export const icloudProvider = new ICloudProvider();
