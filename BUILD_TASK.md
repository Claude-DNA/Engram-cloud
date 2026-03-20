# Build Task: Channels 3-4 + Budget Scheduler

Read docs/ingestion-channels-prompt.md. Channels 1 and 2 are already built. Implement:

## CHANNEL 3: Cloud Storage
- src/engine/import/channels/CloudChannel.ts
- src/engine/import/channels/cloud/DriveProvider.ts
- src/engine/import/channels/cloud/DropboxProvider.ts  
- src/engine/import/channels/cloud/ICloudProvider.ts
- src/engine/import/channels/cloud/CloudBrowser.tsx
- src/engine/import/channels/cloud/OAuthManager.ts
- src/views/settings/CloudStorageSettings.tsx

## CHANNEL 4: Live Social Accounts
- src/engine/import/channels/SocialChannel.ts
- src/engine/import/channels/social/TwitterLiveProvider.ts
- src/engine/import/channels/social/InstagramLiveProvider.ts
- src/engine/import/channels/social/YouTubeLiveProvider.ts
- src/engine/import/channels/social/SocialSyncManager.ts
- src/engine/import/channels/social/RateLimiter.ts
- src/views/settings/SocialAccountsSettings.tsx
- src/components/import/SocialSyncProgress.tsx

## AREA 5: Budget Scheduler
- src/engine/scheduler/IngestionScheduler.ts
- src/engine/scheduler/BudgetManager.ts
- src/engine/scheduler/SourceSurveyor.ts
- src/engine/scheduler/PriorityEngine.ts
- src/engine/scheduler/SchedulerDashboard.tsx
- src/views/settings/BudgetSettings.tsx
- src/views/settings/SourcePrioritySettings.tsx
- src/stores/schedulerStore.ts

## Rules
- Tauri v2 + React + TypeScript
- For Rust-side Tauri commands (oauth, social fetch), create invoke() wrappers that call Tauri commands (the Rust implementation will be added on Mac later)
- Wire new settings views into the existing Settings.tsx page
- DO NOT modify existing Channel 1 or Channel 2 code
- Commit when done
