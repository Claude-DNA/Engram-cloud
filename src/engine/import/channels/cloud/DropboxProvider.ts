// DropboxProvider.ts — Dropbox API client

import { invoke } from '@tauri-apps/api/core';
import { oauthManager } from './OAuthManager';
import type { CloudFile, StorageQuota, ListOptions } from './DriveProvider';

interface DropboxEntry {
  '.tag': 'file' | 'folder';
  id: string;
  name: string;
  path_display: string;
  size?: number;
  server_modified?: string;
}

interface DropboxListResponse {
  entries: DropboxEntry[];
  cursor: string;
  has_more: boolean;
}

export class DropboxProvider {
  readonly name = 'Dropbox';

  async connect(): Promise<void> {
    await oauthManager.startOAuth('dropbox');
  }

  async disconnect(): Promise<void> {
    await oauthManager.revokeTokens('dropbox');
  }

  async isConnected(): Promise<boolean> {
    return oauthManager.isConnected('dropbox');
  }

  async getAccountInfo(): Promise<{ email: string; name: string; quota: StorageQuota }> {
    const token = await oauthManager.getValidAccessToken('dropbox');
    const account = await invoke<{ email: string; name: { display_name: string }; }>('oauth_api_request', {
      url: 'https://api.dropboxapi.com/2/users/get_current_account',
      token,
      method: 'POST',
      body: null,
    });
    const space = await invoke<{ used: number; allocation: { allocated: number } }>('oauth_api_request', {
      url: 'https://api.dropboxapi.com/2/users/get_space_usage',
      token,
      method: 'POST',
      body: null,
    });
    return {
      email: account.email ?? '',
      name: account.name?.display_name ?? '',
      quota: { used: space.used ?? 0, total: space.allocation?.allocated ?? 0 },
    };
  }

  async listFiles(path: string = '', options: ListOptions = {}): Promise<{ files: CloudFile[]; cursor?: string; hasMore: boolean }> {
    const token = await oauthManager.getValidAccessToken('dropbox');

    let response: DropboxListResponse;

    if (options.pageToken) {
      // Continue pagination
      response = await invoke<DropboxListResponse>('oauth_api_request', {
        url: 'https://api.dropboxapi.com/2/files/list_folder/continue',
        token,
        method: 'POST',
        body: JSON.stringify({ cursor: options.pageToken }),
      });
    } else {
      response = await invoke<DropboxListResponse>('oauth_api_request', {
        url: 'https://api.dropboxapi.com/2/files/list_folder',
        token,
        method: 'POST',
        body: JSON.stringify({
          path: path || '',
          limit: options.pageSize ?? 50,
          recursive: false,
        }),
      });
    }

    return {
      files: (response.entries ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        path: e.path_display,
        mimeType: e['.tag'] === 'folder' ? 'folder' : this.guessMimeType(e.name),
        size: e.size ?? 0,
        modifiedDate: e.server_modified ?? '',
        isFolder: e['.tag'] === 'folder',
      })),
      cursor: response.cursor,
      hasMore: response.has_more,
    };
  }

  async downloadFile(path: string): Promise<string> {
    const token = await oauthManager.getValidAccessToken('dropbox');
    return invoke<string>('oauth_download_file', {
      url: 'https://content.dropboxapi.com/2/files/download',
      token,
      headers: { 'Dropbox-API-Arg': JSON.stringify({ path }) },
    });
  }

  private guessMimeType(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain', md: 'text/markdown', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', heic: 'image/heic', zip: 'application/zip',
    };
    return mimeMap[ext ?? ''] ?? 'application/octet-stream';
  }
}

export const dropboxProvider = new DropboxProvider();
