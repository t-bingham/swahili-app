import { getCurrentLanguage } from '../database/db';
import {
  clearSyncState as clearDriveSyncState,
  getLastSyncTime as getDriveLastSyncTime,
  syncWithDrive,
} from './driveSync';

export type SyncProviderId = 'google-drive';

export interface SyncOptions {
  tokenOverride?: string;
  allowRefresh?: boolean;
}

export interface SyncProvider {
  id: SyncProviderId;
  label: string;
  supportsLanguage(languageId: string): boolean;
  sync(options?: SyncOptions): Promise<boolean>;
  getLastSyncTime(): Date | null;
  clearState(): void;
}

export const FUTURE_CONVEX_COLLECTIONS = [
  'users',
  'languages',
  'curriculum_packages',
  'curriculum_units',
  'cards',
  'user_progress_events',
  'review_notes',
  'sync_cursors',
] as const;

const googleDriveProvider: SyncProvider = {
  id: 'google-drive',
  label: 'Google Drive',
  supportsLanguage: (languageId: string) => languageId === 'sw',
  sync: (options: SyncOptions = {}) => syncWithDrive(options),
  getLastSyncTime: getDriveLastSyncTime,
  clearState: clearDriveSyncState,
};

export function getActiveSyncProvider(): SyncProvider {
  return googleDriveProvider;
}

export function canSyncCurrentLanguage(): boolean {
  return getActiveSyncProvider().supportsLanguage(getCurrentLanguage());
}

export async function syncNow(options: SyncOptions = {}): Promise<boolean> {
  const provider = getActiveSyncProvider();
  if (!provider.supportsLanguage(getCurrentLanguage())) return false;
  return provider.sync(options);
}

export function getLastSyncTime(): Date | null {
  return getActiveSyncProvider().getLastSyncTime();
}

export function clearSyncState(): void {
  getActiveSyncProvider().clearState();
}
