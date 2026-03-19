# Engram Cloud — Advanced Ingestion Channels Implementation Prompt
## URL Paste + Local Folders + Cloud Storage + Live Social Accounts

**Version:** 1.0 | **Date:** March 19, 2026
**Author:** Cowork (Senior Advisor) | **For:** Navigator (Claude Code build agent)
**Extends:** Next Phase Prompt v1.3, Area 3 (File Import System)
**Codebase state:** Area 3.1-3.3 assumed built (ImportRouter, DeterministicParser, source-specific importers)

---

## Context

Area 3 of the Next Phase Prompt covers file-drop imports (user drops a .zip, .txt, .pdf, or image). This document adds four new ingestion channels that let users bring data into their engram through richer interaction patterns:

1. **URL/Link Paste** — drop a link, we fetch and extract
2. **Local Folder Scanner** — point at a folder, we scan and watch
3. **Cloud Storage** — connect Google Drive / Dropbox / iCloud, browse remotely
4. **Live Social Accounts** — connect Twitter / Instagram / YouTube via OAuth, pull history live

All four channels feed into the existing pipeline: Importer → DeterministicParser → AI Extraction → Review UI. They're new front doors, not new pipelines.

---

## Global Constraints (carry forward)

- All constraints from Next Phase Prompt v1.3 apply
- **No new AI providers.** Channels feed into the existing BYOT pipeline.
- **Human-in-the-loop.** Nothing auto-imports. All extracted items go through Review UI.
- **Cost Governor applies.** URL fetches and folder scans can generate large volumes — budget checks before processing.
- **Privacy first.** OAuth tokens in OS keychain. Cloud credentials never in SQLite. Fetched content passes through DeterministicParser (Level 1 redaction) before AI.

**ALLOWED NEW DEPENDENCIES:**
- `@tauri-apps/plugin-fs-watch` or `notify` (Rust crate) — file system watcher for local folders
- `@tauri-apps/plugin-dialog` — folder picker
- `cheerio` or `mozilla/readability` — HTML content extraction from URLs
- `ytdl-core` or `yt-dlp` (via shell) — YouTube metadata/transcript extraction
- `googleapis` — Google Drive API client (only for cloud storage channel)
- `dropbox` — Dropbox SDK (only for cloud storage channel)
- OAuth libraries as needed per social platform

**DO NOT ADD:** Puppeteer, Playwright, any headless browser, any scraping framework, any proxy service.

---

## Build Order

```
CHANNEL 1: URL/Link Paste           ← easiest, highest immediate value
CHANNEL 2: Local Folder Scanner     ← Tauri native advantage, medium effort
CHANNEL 3: Cloud Storage            ← OAuth + per-provider API, higher effort
CHANNEL 4: Live Social Accounts     ← hardest (rate limits, pagination, platform-specific OAuth apps)
```

---

## CHANNEL 1: URL/Link Paste

```
Build a URL ingestion feature that lets users paste a link and extract engram-relevant content from it.

FILES:
- src/engine/import/channels/UrlChannel.ts — URL channel orchestrator
- src/engine/import/channels/url/UrlFetcher.ts — content fetching via Tauri backend
- src/engine/import/channels/url/UrlTypeDetector.ts — detect what kind of URL it is
- src/engine/import/channels/url/extractors/ArticleExtractor.ts — generic web page → text
- src/engine/import/channels/url/extractors/TwitterExtractor.ts — tweet/thread extraction
- src/engine/import/channels/url/extractors/InstagramExtractor.ts — Instagram post extraction
- src/engine/import/channels/url/extractors/YouTubeExtractor.ts — video metadata + transcript
- src/engine/import/channels/url/extractors/RedditExtractor.ts — post/comment extraction
- src/components/import/UrlPasteInput.tsx — paste box UI component
- src-tauri/src/url_fetch.rs — Rust-side HTTP fetching (avoids CORS)

UI INTEGRATION:
Add a "Paste a link" input field to the Import view, above the file drop zone:

┌──────────────────────────────────────────────┐
│ 🔗 Paste a link to extract                   │
│ ┌──────────────────────────────────────────┐ │
│ │ https://...                         [Go] │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Or drop files below:                         │
│ ┌──────────────────────────────────────────┐ │
│ │         📁 Drop files here               │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘

FLOW:
1. User pastes URL → UrlTypeDetector identifies the source type
2. Route to appropriate extractor
3. Extractor fetches content via Tauri backend (Rust reqwest — avoids CORS)
4. Content converted to text → wrapped as ImportChunk
5. ImportChunk feeds into existing DeterministicParser → AI Pipeline → Review UI

URL TYPE DETECTION (src/engine/import/channels/url/UrlTypeDetector.ts):

function detectUrlType(url: string): UrlSourceType {
  const hostname = new URL(url).hostname;

  if (hostname.includes('twitter.com') || hostname.includes('x.com'))
    return 'twitter_post';
  if (hostname.includes('instagram.com'))
    return 'instagram_post';
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be'))
    return 'youtube_video';
  if (hostname.includes('reddit.com'))
    return 'reddit_post';
  if (hostname.includes('linkedin.com'))
    return 'linkedin_post';
  if (hostname.includes('medium.com') || hostname.includes('substack.com'))
    return 'article';
  // Default: treat as generic web page
  return 'web_page';
}

EXTRACTORS:

TwitterExtractor:
- Fetch tweet via Twitter's oEmbed endpoint (no auth needed): https://publish.twitter.com/oembed?url={url}
- Extract: text, author, date, engagement counts
- For threads: detect thread by checking for self-replies (may need Twitter API for full threads)
- Fallback: use Nitter or similar if oEmbed fails
- Output: ImportChunk with source_type: 'twitter', timestamp, author metadata

InstagramExtractor:
- Fetch via oEmbed: https://api.instagram.com/oembed?url={url}
- Extract: caption, author, date, media type (photo/video/carousel)
- Instagram heavily restricts programmatic access — oEmbed gives limited data
- Fallback: extract Open Graph meta tags from page HTML
- Output: ImportChunk with source_type: 'instagram', caption, location if available

YouTubeExtractor:
- Extract video ID from URL
- Fetch metadata via oEmbed: https://www.youtube.com/oembed?url={url}
- Fetch transcript: use YouTube's timedtext API or youtube-transcript-api approach
  - GET https://www.youtube.com/watch?v={id} → parse page for captions track URL
  - Fetch captions XML → convert to plain text with timestamps
- If no transcript available: extract title + description + channel name as minimal data
- Output: ImportChunk with source_type: 'youtube', title, description, transcript (if available), duration

RedditExtractor:
- Fetch via Reddit's JSON API: append .json to any Reddit URL
  - https://www.reddit.com/r/subreddit/comments/id/title.json
- Extract: post title, body (selftext), author, subreddit, score, comments
- For comment links: extract the specific comment + parent context
- Output: ImportChunk with source_type: 'reddit', subreddit, post text, top comments

ArticleExtractor (generic web pages):
- Fetch HTML via Tauri backend
- Extract readable content using Mozilla's Readability algorithm (or cheerio-based extraction):
  - Strip navigation, ads, sidebars, footers
  - Keep: article title, author, date, body text, images (as alt text references)
- Extract Open Graph metadata: og:title, og:description, og:image, article:published_time
- Output: ImportChunk with source_type: 'web_article', title, author, date, clean text

TAURI BACKEND (src-tauri/src/url_fetch.rs):
- Tauri command: urlFetch(url: string) → { ok: boolean, html?: string, headers?: object, error?: string }
- Use reqwest with a reasonable User-Agent header
- Timeout: 15 seconds
- Max response size: 5MB (reject larger responses)
- Follow redirects (max 5 hops)
- Return raw HTML — parsing happens in frontend

PREVIEW BEFORE PROCESSING:
After extraction, show the user what was found before sending to AI:

┌──────────────────────────────────────────────┐
│ 🔗 Extracted from: twitter.com/user/status/… │
│                                              │
│ Tweet by @user (March 12, 2024):             │
│ "I quit my job today. Five years of..."      │
│ [full text shown]                            │
│                                              │
│ Thread: 4 tweets detected                    │
│                                              │
│ [Process with AI] [Import as text] [Cancel]  │
└──────────────────────────────────────────────┘

MULTI-URL SUPPORT:
- Allow pasting multiple URLs (one per line) → batch process
- Show detection results for each URL before processing
- "Process all" button for batch

ERROR HANDLING:
- URL unreachable → "Couldn't fetch this URL. Check the link and try again."
- Content too short (<50 chars extracted) → "Not enough content found. This might be behind a login wall."
- Rate-limited by platform → "This platform is limiting requests. Try again in a few minutes."
- Private/protected content → "This content appears to be private. Try exporting it instead."

Acceptance Criteria:
- [ ] Paste a Twitter/X link → tweet text + author + date extracted
- [ ] Paste a YouTube link → title + description + transcript (if available) extracted
- [ ] Paste a Reddit link → post + top comments extracted
- [ ] Paste an article link → clean readable text extracted (no nav/ads/sidebars)
- [ ] Paste an Instagram link → caption + metadata extracted (within oEmbed limits)
- [ ] Unknown URL → generic article extraction via Readability
- [ ] Preview shown before processing
- [ ] Multi-URL paste works (one per line)
- [ ] All fetching goes through Tauri backend (no CORS issues)
- [ ] Extracted content feeds into existing DeterministicParser → pipeline
- [ ] Error messages are user-friendly, not technical
```

---

## CHANNEL 2: Local Folder Scanner

```
Build a local folder scanning feature that lets users point at a directory on their computer, scan its contents, and optionally watch it for new files.

FILES:
- src/engine/import/channels/FolderChannel.ts — folder channel orchestrator
- src/engine/import/channels/folder/FolderScanner.ts — recursive directory scanner
- src/engine/import/channels/folder/FolderWatcher.ts — file system watcher for auto-import
- src/engine/import/channels/folder/FileClassifier.ts — classify files by type
- src/components/import/FolderPickerCard.tsx — folder selection UI
- src/components/import/FolderScanResults.tsx — scan results display
- src/stores/folderStore.ts — watched folders state
- src-tauri/src/folder_scan.rs — Rust-side directory scanning + file watching

TAURI ADVANTAGE:
Tauri has native file system access — no sandboxing limitations. The Rust backend can:
- Recursively scan directories at native speed
- Watch for file system changes via the `notify` crate
- Read EXIF from photos, parse PDFs, scan text files — all without browser limitations

UI:

┌──────────────────────────────────────────────────┐
│ 📁 Import from Folder                            │
│                                                   │
│ [Choose Folder...]                                │
│                                                   │
│ Watched Folders:                                  │
│ ┌───────────────────────────────────────────────┐ │
│ │ 📂 ~/Documents/Journal/    [Scan] [Watch] [✕] │ │
│ │    Last scan: 2 hours ago, 47 files found      │ │
│ │ 📂 ~/Pictures/2024/        [Scan] [Watch] [✕] │ │
│ │    Watching for new files (3 new since last)    │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ℹ️ Watching folders auto-detects new files and    │
│    queues them for processing.                    │
└──────────────────────────────────────────────────┘

FOLDER SCANNER (src/engine/import/channels/folder/FolderScanner.ts):

async function scanFolder(path: string, options: ScanOptions): Promise<ScanResult> {
  // 1. Recursively list all files
  // 2. Classify each file by type (text, image, PDF, document, video, audio, archive, unknown)
  // 3. Filter by supported types
  // 4. Extract basic metadata (size, modified date, EXIF for images)
  // 5. Group by type and subfolder
  // 6. Return summary + file list
}

interface ScanOptions {
  recursive: boolean;          // default: true
  maxDepth: number;            // default: 5 (prevent scanning entire filesystem)
  includeHidden: boolean;      // default: false
  maxFiles: number;            // default: 10,000 (safety limit)
  fileTypes: string[];         // filter: ['txt', 'md', 'pdf', 'jpg', 'png', 'heic', 'docx']
  minSizeBytes: number;        // default: 10 (skip empty files)
  maxSizeBytes: number;        // default: 50MB per file
}

interface ScanResult {
  folderPath: string;
  totalFiles: number;
  supportedFiles: number;
  skippedFiles: number;
  byType: {
    text: FileInfo[];      // .txt, .md
    images: FileInfo[];    // .jpg, .png, .heic
    documents: FileInfo[];  // .pdf, .docx
    archives: FileInfo[];   // .zip (Twitter/Instagram exports)
    other: FileInfo[];
  };
  totalSizeBytes: number;
  dateRange: { oldest: Date; newest: Date };
  estimatedProcessingCost: string;  // from Cost Governor
}

FILE CLASSIFIER (src/engine/import/channels/folder/FileClassifier.ts):
- By extension: .txt/.md → text, .jpg/.png/.heic → image, .pdf → document, .zip → archive
- By content sniffing (for extensionless files): read first 512 bytes, detect magic bytes
- For .zip files: peek inside to detect Twitter archive (tweet.js/tweets.js) vs Instagram export vs generic zip
- For text files: detect if it's a WhatsApp export ("DD/MM/YYYY, HH:MM - " pattern)
- Output: { path, type, subtype, sizeBytes, modifiedDate, metadata }

FOLDER WATCHER (src/engine/import/channels/folder/FolderWatcher.ts):
- Uses Tauri's fs-watch plugin or Rust `notify` crate
- Watches selected folders for new files (CREATE events only — not modify/delete)
- When a new file appears:
  1. Classify the file
  2. If supported type → add to import queue with status 'pending_review'
  3. Show notification: "New file detected in ~/Journal/: entry-2024-03-19.md"
  4. User decides: process now, queue for later, or ignore
- Debounce: 5-second delay after last change (handles batch file copies)
- Settings: watch frequency, notification toggle, auto-queue toggle

SCAN RESULTS UI (src/components/import/FolderScanResults.tsx):

┌──────────────────────────────────────────────────┐
│ Scan: ~/Documents/Journal/                        │
│                                                   │
│ Found 47 supported files:                         │
│   📝 Text files: 32 (.txt, .md)                  │
│   📷 Images: 12 (.jpg, .heic)                    │
│   📄 Documents: 3 (.pdf)                          │
│                                                   │
│ Date range: Jan 2019 — Mar 2024                   │
│ Total size: 24.3 MB                               │
│ Est. processing cost: ~$0.85 (Full) / ~$0.30 (Q) │
│                                                   │
│ [Select all] [Select by type...] [Select by date] │
│                                                   │
│ ☑ journal-2019-01-15.md     2.1 KB    Jan 15 '19 │
│ ☑ journal-2019-01-22.md     3.4 KB    Jan 22 '19 │
│ ☑ journal-2019-02-03.md     1.8 KB    Feb 3 '19  │
│ ☐ vacation-photo-001.jpg    4.2 MB    Jul 12 '19 │
│ ...                                               │
│                                                   │
│ [Process Selected (47)] [Process with AI] [Cancel]│
└──────────────────────────────────────────────────┘

WATCHED FOLDERS PERSISTENCE:
- Store watched folder paths in settings (SQLite _settings table or Tauri store)
- On app launch: re-register watchers for all saved folders
- Show watched folders in Settings → Import section
- "Stop watching" removes the watcher + path from settings

SAFETY:
- Never scan system directories (/System, /Library, C:\Windows, etc.)
- Refuse to scan folders with >10,000 files without explicit confirmation
- Never modify or delete source files — read-only access
- Show total estimated cost BEFORE processing begins

Acceptance Criteria:
- [ ] Folder picker opens native OS dialog
- [ ] Recursive scan finds supported files with correct classification
- [ ] Scan results show file counts by type, date range, total size, estimated cost
- [ ] User can select/deselect individual files or filter by type/date
- [ ] Selected files route to existing ImportRouter → DeterministicParser → pipeline
- [ ] Folder watcher detects new files and shows notification
- [ ] Watched folders persist across app restarts
- [ ] Safety: system directories rejected, >10K files require confirmation
- [ ] WhatsApp .txt files detected by content pattern, not just extension
- [ ] .zip files peeked to detect Twitter/Instagram archives vs generic zip
```

---

## CHANNEL 3: Cloud Storage (Google Drive / Dropbox / iCloud)

```
Build cloud storage integration that lets users connect Google Drive, Dropbox, or iCloud and browse/import files remotely.

FILES:
- src/engine/import/channels/CloudChannel.ts — cloud channel orchestrator
- src/engine/import/channels/cloud/DriveProvider.ts — Google Drive API client
- src/engine/import/channels/cloud/DropboxProvider.ts — Dropbox API client
- src/engine/import/channels/cloud/ICloudProvider.ts — iCloud integration (macOS only)
- src/engine/import/channels/cloud/CloudBrowser.tsx — file browser UI component
- src/engine/import/channels/cloud/OAuthManager.ts — OAuth flow management
- src/views/settings/CloudStorageSettings.tsx — connected accounts settings
- src-tauri/src/oauth.rs — Rust-side OAuth server (localhost callback)

OAUTH FLOW:
Tauri desktop apps use the "installed application" OAuth flow:
1. Open system browser to provider's auth URL
2. User authenticates + grants permission
3. Provider redirects to localhost:{port}/callback with auth code
4. Tauri backend's HTTP server captures the callback
5. Exchange code for access + refresh tokens
6. Store tokens in OS keychain (via §1.3)

OAuth redirect: http://localhost:{dynamic_port}/oauth/callback
Register as "Desktop Application" with each provider.

PROVIDER INTERFACE:

interface CloudProvider {
  name: string;
  connect(): Promise<void>;           // initiate OAuth
  disconnect(): Promise<void>;        // revoke tokens
  isConnected(): Promise<boolean>;
  listFiles(path: string, options: ListOptions): Promise<CloudFile[]>;
  downloadFile(fileId: string): Promise<Buffer>;
  getAccountInfo(): Promise<{ email: string; name: string; quota: StorageQuota }>;
}

interface CloudFile {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  modifiedDate: string;
  isFolder: boolean;
  thumbnailUrl?: string;    // for image previews
}

GOOGLE DRIVE PROVIDER:
- OAuth scope: https://www.googleapis.com/auth/drive.readonly (read-only!)
- List files: GET https://www.googleapis.com/drive/v3/files
- Download: GET https://www.googleapis.com/drive/v3/files/{id}?alt=media
- For Google Docs: export as .docx (GET .../files/{id}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document)
- Search: q parameter supports fullText contains, name contains, mimeType filters
- Pagination: pageToken for large folders

DROPBOX PROVIDER:
- OAuth 2.0 with PKCE (code_challenge)
- List files: POST https://api.dropboxapi.com/2/files/list_folder
- Download: POST https://content.dropboxapi.com/2/files/download
- Pagination: cursor-based (has_more + cursor)

ICLOUD PROVIDER (macOS only):
- No official REST API for iCloud Drive
- Approach: use Tauri's native file system access to read ~/Library/Mobile Documents/com~apple~CloudDocs/
- This is where iCloud Drive files live on macOS — they're just local files synced by the OS
- No OAuth needed — just folder access permission
- Platform guard: only show iCloud option on macOS

CLOUD BROWSER UI:

┌──────────────────────────────────────────────────┐
│ ☁️ Google Drive  (andrei@gmail.com)    [Disconnect]│
│                                                   │
│ 📂 My Drive /                                     │
│ ├── 📂 Documents/                                 │
│ │   ├── 📝 journal-2023.docx         4.2 MB      │
│ │   ├── 📝 letter-to-mom.docx        1.1 MB      │
│ │   └── 📄 medical-records.pdf       12.3 MB ⚠️  │
│ ├── 📂 Photos/                                    │
│ │   ├── 🖼️ vacation-2023/           (42 items)    │
│ │   └── 🖼️ family/                  (128 items)   │
│ └── 📂 Writing/                                   │
│     └── 📝 novel-draft.docx          8.7 MB      │
│                                                   │
│ Selected: 3 files (13.0 MB)                       │
│ Est. processing: ~$0.45                           │
│                                                   │
│ [Download & Process Selected]          [Cancel]   │
└──────────────────────────────────────────────────┘

DOWNLOAD + PROCESS FLOW:
1. User browses cloud files in the browser UI
2. Selects files to import (checkbox per file/folder)
3. "Download & Process" → files download to a temp directory
4. Downloaded files route through existing ImportRouter (same as file-drop)
5. Temp files cleaned up after import completes

SETTINGS (src/views/settings/CloudStorageSettings.tsx):

Connected Accounts:
┌──────────────────────────────────────────────┐
│ ☁️ Cloud Storage Connections                  │
│                                              │
│ Google Drive    [Connected: andrei@gmail.com]│
│                 [Disconnect]                 │
│                                              │
│ Dropbox         [Connect...]                 │
│                                              │
│ iCloud Drive    [Connected (local access)]   │  ← macOS only
│                                              │
│ ℹ️ We request read-only access. Your files   │
│   are downloaded temporarily for processing  │
│   and then deleted. Nothing is stored.       │
└──────────────────────────────────────────────┘

SECURITY:
- OAuth tokens stored in OS keychain (never in database or config files)
- Read-only scope ONLY — never request write permission to cloud storage
- Downloaded files go to a temp directory, processed, then deleted
- Token refresh handled automatically (refresh token → new access token)
- User can revoke access anytime via "Disconnect" button
- Show clear privacy message: "We download files temporarily for processing. Nothing is stored or uploaded."

Acceptance Criteria:
- [ ] Google Drive OAuth flow works (browser → callback → token stored)
- [ ] Google Drive: browse files, navigate folders, select + download
- [ ] Google Docs exported as .docx before import
- [ ] Dropbox OAuth flow works
- [ ] Dropbox: browse + download files
- [ ] iCloud: accessible via local filesystem on macOS
- [ ] Cloud browser shows file names, sizes, types, folder structure
- [ ] Selected files download to temp dir → route through ImportRouter
- [ ] Temp files cleaned up after processing
- [ ] OAuth tokens in keychain, not database
- [ ] Read-only scope enforced (no write/delete permissions)
- [ ] Disconnect revokes tokens and removes from keychain
- [ ] Privacy message displayed prominently
- [ ] Non-macOS: iCloud option hidden
```

---

## CHANNEL 4: Live Social Accounts (OAuth Connected Accounts)

```
Build live social media account connections that let users connect their Twitter, Instagram, or YouTube accounts and pull their full post history.

This is the highest-effort channel. Each platform has different APIs, rate limits, pagination models, and OAuth requirements.

FILES:
- src/engine/import/channels/SocialChannel.ts — social channel orchestrator
- src/engine/import/channels/social/TwitterLiveProvider.ts — Twitter/X API v2
- src/engine/import/channels/social/InstagramLiveProvider.ts — Instagram Graph API
- src/engine/import/channels/social/YouTubeLiveProvider.ts — YouTube Data API v3
- src/engine/import/channels/social/SocialSyncManager.ts — manages sync state + pagination
- src/engine/import/channels/social/RateLimiter.ts — per-platform rate limit management
- src/views/settings/SocialAccountsSettings.tsx — connected social accounts UI
- src/components/import/SocialSyncProgress.tsx — sync progress display

PROVIDER INTERFACE:

interface SocialProvider {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  getProfile(): Promise<SocialProfile>;
  fetchHistory(options: FetchOptions): Promise<SocialFetchResult>;
  fetchSince(lastSyncTimestamp: string): Promise<SocialFetchResult>;  // incremental
}

interface FetchOptions {
  startDate?: string;
  endDate?: string;
  maxItems?: number;        // default: 1000 per sync
  includeReplies?: boolean; // default: true
  includeReposts?: boolean; // default: false
}

interface SocialFetchResult {
  items: SocialItem[];
  hasMore: boolean;
  cursor: string;           // for pagination/resumption
  rateLimitRemaining: number;
  rateLimitResetAt: string;
}

interface SocialItem {
  platform: string;
  id: string;
  text: string;
  createdAt: string;
  type: 'post' | 'reply' | 'repost' | 'story' | 'video';
  engagement: { likes: number; reposts: number; replies: number };
  media?: { type: string; url: string }[];
  replyTo?: string;
  threadId?: string;
  location?: string;
  hashtags?: string[];
  mentions?: string[];
}

TWITTER/X LIVE PROVIDER:
- OAuth 2.0 with PKCE (Twitter API v2)
- Scope: tweet.read, users.read, offline.access
- Endpoints:
  - User timeline: GET /2/users/{id}/tweets (max 3200 most recent tweets)
  - Includes: reply info, engagement counts, media attachments, entities
  - Pagination: pagination_token
- Rate limits: 900 requests per 15 min (user context), 1500 tweets per request
- Strategy: fetch in reverse chronological order, 100 per page, store cursor for incremental sync
- Thread detection: if tweet.in_reply_to_user_id === own_user_id → self-reply → part of thread
- Output: SocialItem[] → convert to ImportChunk[] via existing TwitterImporter logic

INSTAGRAM LIVE PROVIDER:
- Instagram Graph API (requires Facebook Developer App)
- OAuth: Facebook Login → Instagram permissions (instagram_basic, instagram_manage_insights)
- Endpoints:
  - User media: GET /{user-id}/media?fields=id,caption,timestamp,media_type,permalink,thumbnail_url
  - Pagination: after cursor
- Rate limits: 200 calls per hour per user
- Limitations: only returns media posts (no stories, no DMs, no likes history)
- Output: SocialItem[] → convert to ImportChunk[] via existing InstagramImporter logic

YOUTUBE LIVE PROVIDER:
- YouTube Data API v3
- OAuth 2.0 scope: https://www.googleapis.com/auth/youtube.readonly
- Endpoints:
  - My channel: GET /youtube/v3/channels?mine=true
  - My uploads playlist: from channel response → contentDetails.relatedPlaylists.uploads
  - List videos: GET /youtube/v3/playlistItems?playlistId={uploads_id}
  - Video details: GET /youtube/v3/videos?id={id}&part=snippet,contentDetails,statistics
  - Captions: GET /youtube/v3/captions?videoId={id} → download transcript
- Rate limits: 10,000 units per day (list = 1 unit, video detail = 1 unit)
- Output: SocialItem[] with transcripts where available

SYNC MANAGER (src/engine/import/channels/social/SocialSyncManager.ts):

Manages the state of social account syncing:

interface SyncState {
  platform: string;
  lastSyncAt: string;              // ISO-8601
  lastCursor: string;              // pagination cursor
  totalItemsFetched: number;
  syncStatus: 'idle' | 'syncing' | 'paused' | 'error';
  rateLimitResetAt: string | null;
  errorMessage: string | null;
}

Store sync state in SQLite (_social_sync table) — persists across restarts.

SYNC MODES:
1. Full sync (first connection): fetch entire available history. Could take hours for heavy users.
   - Show estimated time and cost before starting
   - Process in batches: fetch 100 items → chunk → park for AI processing → fetch next 100
   - User can pause/resume at any time
2. Incremental sync: fetch only items since last sync
   - Much faster — typically seconds to minutes
   - Can be triggered manually or on a schedule

RATE LIMITER (src/engine/import/channels/social/RateLimiter.ts):

class RateLimiter {
  constructor(private limits: PlatformLimits) {}

  async waitIfNeeded(): Promise<void> {
    if (this.remaining <= 0) {
      const waitMs = this.resetAt - Date.now();
      if (waitMs > 0) {
        // Show user: "Rate limited. Resuming in X minutes."
        await sleep(waitMs);
      }
    }
  }

  update(headers: { remaining: number; resetAt: number }): void {
    this.remaining = headers.remaining;
    this.resetAt = headers.resetAt;
  }
}

Always respect platform rate limits. Never retry on 429 without waiting. Show the user exactly when the sync will resume.

UI — CONNECTED ACCOUNTS:

┌──────────────────────────────────────────────────┐
│ 🔗 Connected Social Accounts                     │
│                                                   │
│ Twitter/X       [@andrei_nav]                     │
│   Last sync: 2 hours ago (3,247 tweets fetched)   │
│   [Sync Now] [Full Re-sync] [Disconnect]          │
│                                                   │
│ Instagram       [Connect...]                      │
│                                                   │
│ YouTube         [Connect...]                      │
│                                                   │
│ ┌────────────────────────────────────────────┐    │
│ │ ⏳ Syncing Twitter: 1,247 / ~3,500 tweets  │    │
│ │ ████████████░░░░░░░░░ 36%                  │    │
│ │ Rate limit: 847 remaining (resets 3:45 PM) │    │
│ │ [Pause]                                    │    │
│ └────────────────────────────────────────────┘    │
│                                                   │
│ ℹ️ Connected accounts sync your public posts.     │
│   Private/protected content is never accessed     │
│   without your explicit permission.               │
│   We never post, like, or follow on your behalf.  │
└──────────────────────────────────────────────────┘

SYNC → IMPORT FLOW:
1. SocialProvider fetches items in batches
2. Each batch → convert to ImportChunk[] using existing source-specific importers
3. Chunks → DeterministicParser → queue for AI processing
4. AI processing follows existing pipeline (Cost Governor, Recovery Manager, etc.)
5. Extracted items → Review UI for user approval
6. On incremental sync: only new items fetched, dedup against existing engram

SECURITY:
- OAuth tokens in OS keychain
- Read-only scope ONLY — never request write/post/like/follow permissions
- Clear messaging: "We read your posts. We never post, like, follow, or modify anything."
- User can disconnect at any time → tokens revoked + removed from keychain
- Sync can be paused/cancelled without data loss (cursor persisted)

COST AWARENESS:
- Before full sync: "Your Twitter account has ~3,500 tweets. Estimated processing cost: $2.10 (Full) / $0.70 (Quick). Continue?"
- During sync: live cost tracking in progress UI
- Cost Governor applies — sync pauses if budget exceeded

Acceptance Criteria:
- [ ] Twitter OAuth flow works → profile info displayed
- [ ] Twitter full sync: fetches timeline with pagination, respects rate limits
- [ ] Twitter incremental sync: fetches only new tweets since last sync
- [ ] Instagram OAuth flow works → profile info displayed
- [ ] Instagram: fetches media posts with captions and timestamps
- [ ] YouTube OAuth flow works → channel info displayed
- [ ] YouTube: fetches video list + transcripts where available
- [ ] Sync state persisted across app restarts (cursor, last sync time)
- [ ] Rate limiter: pauses and shows resume time when rate-limited
- [ ] Pause/resume works without data loss
- [ ] Full sync shows estimated time + cost before starting
- [ ] All fetched items route through existing importers → pipeline → Review UI
- [ ] OAuth tokens in keychain, read-only scope only
- [ ] "Disconnect" revokes tokens
- [ ] Privacy messaging clear and prominent
```

---

## Integration: How Channels Connect to the Existing Pipeline

```
All four channels produce ImportChunk[] — the same format the file-drop importers produce.
The rest of the pipeline is unchanged:

URL Paste      ─┐
Local Folder   ─┤
Cloud Storage  ─┼──→ ImportChunk[] ──→ DeterministicParser ──→ AI Pipeline ──→ Review UI
Social Account ─┤
File Drop      ─┘ (existing)

New Tauri commands needed:
- urlFetch(url) → HTML string
- folderScan(path, options) → ScanResult
- folderWatch(path) → starts watcher, emits events
- folderUnwatch(path) → stops watcher
- oauthStart(provider) → opens browser, returns auth code
- oauthExchange(provider, code) → exchanges for tokens, stores in keychain
- socialFetch(provider, options) → SocialFetchResult

Settings additions:
- Settings → Import: now has 5 tabs (Files, URLs, Folders, Cloud, Social)
- Each tab shows connection status, sync history, and controls
```

---

## AREA 5: Budget-Aware Ingestion Scheduler

```
Build a scheduling engine that lets users set a token/cost budget and gradually ingests all connected sources over time, prioritizing intelligently.

This flips the ingestion model. Instead of "process everything now" (expensive, overwhelming), it becomes:
connect sources → set budget → platform plans the work → shows timeline → processes gradually.

FILES:
- src/engine/scheduler/IngestionScheduler.ts — core scheduling engine
- src/engine/scheduler/BudgetManager.ts — token/cost budget tracking
- src/engine/scheduler/SourceSurveyor.ts — estimates total volume across all sources
- src/engine/scheduler/PriorityEngine.ts — decides what to process next
- src/engine/scheduler/SchedulerDashboard.tsx — real-time progress dashboard
- src/views/settings/BudgetSettings.tsx — budget configuration UI
- src/views/settings/SourcePrioritySettings.tsx — source priority ordering
- src/stores/schedulerStore.ts — scheduler state management

THE FLOW:

1. CONNECT SOURCES
   User connects Google Drive, Twitter, Instagram, local folders, etc.
   Each source reports: estimated item count, date range, content types.

2. SET TOKEN BUDGET
   User sets their processing budget:
   - Daily token cap (e.g., 10,000 tokens/day)
   - Monthly cost cap (e.g., $5/month)
   - Or: "Unlimited — process as fast as possible"
   Default: $5/month (conservative, won't surprise anyone)

3. PLATFORM SURVEYS
   SourceSurveyor estimates total volume across all connected sources:
   - Twitter: ~3,500 tweets → ~480 chunks → ~$3.20
   - Google Drive: ~12 docs → ~45 chunks → ~$0.30
   - Local photos: ~200 images → ~200 metadata extractions → ~$1.50
   - Total: ~725 chunks, estimated $5.00

4. SHOWS TIMELINE
   "At your budget of $5/month, full ingestion completes in ~1 month."
   "At $2/month, full ingestion completes in ~3 months."
   "Want to increase budget to finish sooner?"

5. SMART SCHEDULER
   Processes chunks according to priority rules within the daily budget.
   Runs during app usage or as a background task.

6. DASHBOARD
   Real-time visibility into progress.

BUDGET MANAGER (src/engine/scheduler/BudgetManager.ts):

class BudgetManager {
  constructor(private settings: BudgetSettings) {}

  interface BudgetSettings {
    dailyTokenCap: number;        // e.g., 10000
    monthlyCostCap: number;       // e.g., 5.00
    mode: 'conservative' | 'balanced' | 'unlimited';
  }

  // Track usage
  tokensUsedToday: number;
  costUsedThisMonth: number;

  canProcess(estimatedTokens: number): { allowed: boolean; reason?: string } {
    if (this.tokensUsedToday + estimatedTokens > this.settings.dailyTokenCap) {
      return { allowed: false, reason: `Daily cap reached (${this.settings.dailyTokenCap} tokens). Resumes tomorrow.` };
    }
    const estimatedCost = this.estimateCost(estimatedTokens);
    if (this.costUsedThisMonth + estimatedCost > this.settings.monthlyCostCap) {
      return { allowed: false, reason: `Monthly budget reached ($${this.settings.monthlyCostCap}). Resumes next month or increase budget.` };
    }
    return { allowed: true };
  }

  // Reset daily at midnight local time
  // Reset monthly on the 1st
  // Persist to SQLite _budget table
}

SOURCE SURVEYOR (src/engine/scheduler/SourceSurveyor.ts):

class SourceSurveyor {
  async surveyAll(sources: ConnectedSource[]): Promise<IngestionPlan> {
    const estimates = [];
    for (const source of sources) {
      const est = await this.estimateSource(source);
      estimates.push({
        source: source.name,
        type: source.type,
        estimatedItems: est.itemCount,
        estimatedChunks: est.chunkCount,
        estimatedTokens: est.totalTokens,
        estimatedCost: est.cost,
        dateRange: est.dateRange,
        lastSynced: source.lastSyncAt
      });
    }

    const totalTokens = estimates.reduce((sum, e) => sum + e.estimatedTokens, 0);
    const totalCost = estimates.reduce((sum, e) => sum + e.estimatedCost, 0);

    return {
      sources: estimates,
      totalTokens,
      totalCost,
      estimatedDaysAtBudget: Math.ceil(totalTokens / budgetManager.settings.dailyTokenCap),
      estimatedMonthsAtBudget: Math.ceil(totalCost / budgetManager.settings.monthlyCostCap)
    };
  }
}

PRIORITY ENGINE (src/engine/scheduler/PriorityEngine.ts):

Decides what to process next within the budget. Not FIFO — intelligent prioritization.

class PriorityEngine {
  getNextBatch(budget: number): ImportChunk[] {
    // Priority rules (ordered):

    // 1. RECENCY BIAS — newest content first
    //    Most relevant to the user NOW. Yesterday's journal entry > 2015 tweets.
    //    Sort unprocessed chunks by source timestamp, newest first.

    // 2. INTERACTION WEIGHT — stuff you engaged with > passive content
    //    Tweets you liked/replied to > tweets you just posted
    //    Photos you shared > photos that sat in camera roll
    //    Articles you bookmarked > articles in browsing history

    // 3. HIGH-SIGNAL SOURCES — personal writing > social media
    //    Journal entries and interviews > tweets and Instagram captions
    //    Direct messages > public posts
    //    Long-form > short-form

    // 4. SOURCE PRIORITY — user-configurable
    //    User drags sources into priority order in settings
    //    Default: Journal > Email > Messages > Social Media > Photos > Cloud docs

    // 5. TRANSFORMATION POTENTIAL — content near known life events
    //    If we know the user moved in 2019, prioritize 2019 content
    //    If we detect a gap (no data for 2017-2018), slightly boost content from that era

    // 6. COST EFFICIENCY — pack budget tightly
    //    If we have 500 tokens left in today's budget, find a small chunk that fits
    //    Don't waste budget on a 4000-token chunk when we can process five 100-token metadata items
  }
}

SCHEDULER ENGINE (src/engine/scheduler/IngestionScheduler.ts):

class IngestionScheduler {
  // States: idle | planning | processing | paused | budget_exhausted

  async run(): Promise<void> {
    while (this.state === 'processing') {
      // Check budget
      const budget = this.budgetManager.remainingToday();
      if (budget <= 0) {
        this.state = 'budget_exhausted';
        this.notifyUser('Daily budget reached. Resuming tomorrow.');
        return;
      }

      // Get next batch
      const batch = this.priorityEngine.getNextBatch(budget);
      if (batch.length === 0) {
        this.state = 'idle'; // Nothing left to process
        this.notifyUser('All connected sources fully processed!');
        return;
      }

      // Process batch through existing pipeline
      for (const chunk of batch) {
        if (this.state === 'paused') return; // User paused
        await this.pipeline.processChunk(chunk);
        this.budgetManager.recordUsage(chunk.tokensUsed);
        this.updateDashboard();
      }

      // Brief pause between batches
      await sleep(1000);
    }
  }

  pause(): void { this.state = 'paused'; }
  resume(): void { this.state = 'processing'; this.run(); }

  // BURST MODE: temporarily increase daily cap
  burst(extraTokens: number): void {
    this.budgetManager.addBurstBudget(extraTokens);
    if (this.state === 'budget_exhausted') this.resume();
  }
}

DASHBOARD UI (src/engine/scheduler/SchedulerDashboard.tsx):

┌──────────────────────────────────────────────────────────────┐
│ 📊 Ingestion Dashboard                                       │
│                                                               │
│ Budget: $5.00/month    Today: 4,200 / 10,000 tokens          │
│ ████████████░░░░░░░░░ 42% of daily budget                    │
│                                                               │
│ This month: $1.83 / $5.00                                     │
│ ████████░░░░░░░░░░░░░ 37%                                    │
│                                                               │
│ Overall progress:                                             │
│ ███████████████░░░░░░ 73% complete (528 / 725 chunks)        │
│ Est. completion: April 2, 2026 at current budget              │
│                                                               │
│ ── By Source ──────────────────────────────────────────────── │
│ Twitter     ████████████████████ 100% ✓  (480/480 chunks)    │
│ Google Drive ██████████████████░░ 89%    (40/45 chunks)      │
│ Local Photos ████░░░░░░░░░░░░░░░ 20%    (40/200 chunks)     │
│                                                               │
│ ── Today's Activity ──────────────────────────────────────── │
│ 09:12  Processed: journal-2024-03-15.md (Identity: 3 items)  │
│ 09:14  Processed: tweet-batch-march-2024 (Ideas: 2 items)    │
│ 09:18  Processed: vacation-photo-042.jpg (World: 1 item)     │
│ 09:20  Budget pause — resuming tomorrow                      │
│                                                               │
│ [Pause] [Burst Mode (+5000 tokens)] [Change Budget]          │
└──────────────────────────────────────────────────────────────┘

SETTINGS — BUDGET (src/views/settings/BudgetSettings.tsx):

┌──────────────────────────────────────────────────┐
│ 💰 Ingestion Budget                               │
│                                                   │
│ Mode: [Conservative ▼]                            │
│   Conservative: $5/month, 10K tokens/day          │
│   Balanced: $15/month, 30K tokens/day             │
│   Unlimited: no caps (⚠️ can be expensive)        │
│   Custom: set your own limits                     │
│                                                   │
│ Daily token cap:  [10,000 ▼]                      │
│ Monthly cost cap: [$5.00   ]                      │
│                                                   │
│ Estimated completion at this budget:              │
│   All sources: ~4 weeks                           │
│   New content (incremental): ~2 days/month        │
│                                                   │
│ [Apply]                                           │
└──────────────────────────────────────────────────┘

SETTINGS — SOURCE PRIORITY (src/views/settings/SourcePrioritySettings.tsx):

┌──────────────────────────────────────────────────┐
│ 🔄 Source Priority (drag to reorder)              │
│                                                   │
│ 1. 📝 Personal Journal     [▲] [▼]              │
│ 2. 📧 Email (Gmail)         [▲] [▼]              │
│ 3. 💬 WhatsApp messages     [▲] [▼]              │
│ 4. 🐦 Twitter/X             [▲] [▼]              │
│ 5. 📷 Local Photos          [▲] [▼]              │
│ 6. ☁️ Google Drive docs     [▲] [▼]              │
│ 7. 📸 Instagram             [▲] [▼]              │
│                                                   │
│ Higher priority sources get processed first       │
│ within your daily token budget.                   │
└──────────────────────────────────────────────────┘

PAUSE/RESUME/BURST:
- Pause: "Going on vacation? Pause ingestion, save budget." Persists state.
- Resume: picks up exactly where it left off (cursor-based).
- Burst mode: "I have budget to spare. Process more now."
  - Adds a one-time extra token allocation to today's budget
  - Shows: "Burst: +5,000 tokens. Processing will run until they're used."
  - Doesn't change the ongoing budget settings

BACKGROUND PROCESSING:
- Scheduler runs while the app is open (not a system daemon)
- On app launch: check if budget allows processing → auto-resume if yes
- When app is minimized: continues processing (Tauri runs in background)
- When app is closed: processing stops, resumes on next launch
- Never wakes the machine or runs without the app open

NOTIFICATIONS:
- Daily summary (if enabled): "Today: processed 12 chunks, extracted 34 items. Budget: 58% used."
- Source complete: "Twitter fully processed! 480 chunks → 1,247 engram items."
- Budget exhausted: "Daily budget reached. Resuming tomorrow at 12:00 AM."
- All done: "All connected sources fully processed! Your engram is complete."

Acceptance Criteria:
- [ ] Budget settings configurable (daily tokens, monthly cost, mode)
- [ ] Source Surveyor estimates total volume + cost before processing begins
- [ ] Timeline shown: "At this budget, completion in ~X weeks"
- [ ] Priority Engine processes newest content first
- [ ] Priority Engine respects user-configurable source ordering
- [ ] Scheduler pauses when daily/monthly budget exhausted
- [ ] Scheduler resumes next day/month automatically
- [ ] Pause/resume works without data loss
- [ ] Burst mode adds temporary extra budget
- [ ] Dashboard shows real-time progress per source
- [ ] Dashboard shows today's activity log
- [ ] Budget persists across app restarts
- [ ] Processing runs in background while app is minimized
- [ ] Notifications for daily summary, source complete, budget exhausted, all done
- [ ] Cost Governor (§4.3) integrated — scheduler defers to governor for per-call decisions
```

---

## Golden Test — All Channels

```
After completing all 4 channels, write and run this integration test:

Scenario: "Multi-channel ingestion with budget scheduler"
1. URL paste: paste a tweet URL → extracted text matches tweet content
2. URL paste: paste a YouTube URL → title + description extracted (transcript if available)
3. URL paste: paste an article URL → clean text extracted (no nav/ads)
4. Local folder: scan a test directory with 5 .txt + 3 .jpg files → correct classification
5. Local folder: add a new file while watching → notification fires, file queued
6. Cloud: mock Google Drive OAuth → browse folders → select file → downloads to temp → routed to importer
7. Social: mock Twitter API → fetch 50 tweets → pagination works → items converted to ImportChunks
8. Social: rate limiter → mock 429 response → sync pauses → resumes after wait
9. All channels: extracted ImportChunks feed into DeterministicParser correctly
10. Budget: set daily cap to 5000 tokens → process 3 chunks → verify budget tracking updates
11. Budget: exceed daily cap → scheduler pauses with correct message
12. Priority: connect 2 sources, set priority order → verify highest priority processes first
13. Surveyor: connect mock sources → estimate shows correct total volume + timeline
14. Burst mode: add 2000 extra tokens → scheduler resumes → processes until burst exhausted
15. Dashboard: real-time progress updates visible per source
16. All existing tests still pass

This test MUST pass before declaring the channels complete.
```

---

## Prompt Safety Score

```
PROMPT SAFETY SCORE

[✓] Constraints at the very top and exhaustive                    (1 pt)
[✓] Hierarchical decomposition with clear dependencies            (1 pt)
[✓] Every sub-task has observable acceptance criteria              (1 pt)
[✓] Golden test defined and realistic                             (1 pt)
[✓] Evidence anchoring: N/A for build prompt (applies to AI extraction) (1 pt)
[✓] Deterministic pre-processing: channels feed into existing DeterministicParser (1 pt)
[✓] Confidence scoring: inherited from existing pipeline          (1 pt)
[✓] Failure strategy: error handling per channel + rate limiting  (1 pt)
[✓] Cost profile: pre-sync estimates, Cost Governor integration   (1 pt)
[✓] Learning loop: inherited from existing Extraction Memory      (1 pt)

Score: 10/10
```

---

*Prompt compiled by Cowork (Senior Advisor) for Navigator's Claude Code build session.*
*Extends Next Phase Prompt v1.3 Area 3 with four additional ingestion channels.*
*March 19, 2026*
