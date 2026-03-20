// DriveProvider.ts — Google Drive API client

import { invoke } from '@tauri-apps/api/core';
import { oauthManager } from './OAuthManager';

export interface CloudFile {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  modifiedDate: string;
  isFolder: boolean;
  thumbnailUrl?: string;
}

export interface StorageQuota {
  used: number;
  total: number;
}

export interface ListOptions {
  pageSize?: number;
  pageToken?: string;
  query?: string;
  orderBy?: string;
}

interface DriveFileResponse {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
  thumbnailLink?: string;
}

interface DriveListResponse {
  files: DriveFileResponse[];
  nextPageToken?: string;
}

const GOOGLE_DOCS_MIME = 'application/vnd.google-apps.document';
const EXPORT_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class DriveProvider {
  readonly name = 'Google Drive';

  async connect(): Promise<void> {
    await oauthManager.startOAuth('google_drive');
  }

  async disconnect(): Promise<void> {
    await oauthManager.revokeTokens('google_drive');
  }

  async isConnected(): Promise<boolean> {
    return oauthManager.isConnected('google_drive');
  }

  async getAccountInfo(): Promise<{ email: string; name: string; quota: StorageQuota }> {
    const token = await oauthManager.getValidAccessToken('google_drive');
    const response = await invoke<{ email: string; name: string; storageQuota: { usage: string; limit: string } }>('oauth_api_request', {
      url: 'https://www.googleapis.com/drive/v3/about?fields=user,storageQuota',
      token,
      method: 'GET',
    });
    return {
      email: response.email ?? '',
      name: response.name ?? '',
      quota: {
        used: parseInt(response.storageQuota?.usage ?? '0'),
        total: parseInt(response.storageQuota?.limit ?? '0'),
      },
    };
  }

  async listFiles(folderId: string = 'root', options: ListOptions = {}): Promise<{ files: CloudFile[]; nextPageToken?: string }> {
    const token = await oauthManager.getValidAccessToken('google_drive');
    const params = new URLSearchParams({
      fields: 'files(id,name,mimeType,size,modifiedTime,parents,thumbnailLink),nextPageToken',
      pageSize: String(options.pageSize ?? 50),
      q: options.query ?? `'${folderId}' in parents and trashed = false`,
      orderBy: options.orderBy ?? 'folder,name',
    });
    if (options.pageToken) params.set('pageToken', options.pageToken);

    const response = await invoke<DriveListResponse>('oauth_api_request', {
      url: `https://www.googleapis.com/drive/v3/files?${params}`,
      token,
      method: 'GET',
    });

    return {
      files: (response.files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        path: `/${f.name}`,
        mimeType: f.mimeType,
        size: parseInt(f.size ?? '0'),
        modifiedDate: f.modifiedTime ?? '',
        isFolder: f.mimeType === 'application/vnd.google-apps.folder',
        thumbnailUrl: f.thumbnailLink,
      })),
      nextPageToken: response.nextPageToken,
    };
  }

  async downloadFile(fileId: string, mimeType: string): Promise<string> {
    const token = await oauthManager.getValidAccessToken('google_drive');

    // Google Docs need to be exported
    if (mimeType === GOOGLE_DOCS_MIME) {
      return invoke<string>('oauth_download_file', {
        url: `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(EXPORT_MIME)}`,
        token,
      });
    }

    return invoke<string>('oauth_download_file', {
      url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      token,
    });
  }
}

export const driveProvider = new DriveProvider();
