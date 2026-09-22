import { getDb, getCurrentUser, getCurrentLanguage, mergeRemoteDb, flushDatabase } from '../database/db';
import { getOrRefreshToken, getGoogleToken, getGoogleProfile } from '../auth/googleAuth';

const FILE_NAME = 'swahili.db';

function syncKey(): string {
  const profile = getGoogleProfile();
  return profile ? `drive_last_sync_${profile.email}` : 'drive_last_sync';
}

async function findFile(token: string): Promise<{ id: string; modifiedTime: string } | null> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27${FILE_NAME}%27&fields=files(id,modifiedTime)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error('Could not look up the Drive backup');
  const json = await res.json();
  if (!Array.isArray(json.files)) throw new Error('Invalid Drive file listing');
  return json.files[0] ?? null;
}

async function _upload(token: string, file: { id: string } | null, isCurrent: () => boolean, key: string): Promise<boolean> {
  try {
    if (!isCurrent()) return false;
    const data = getDb().export();
    const metadata = JSON.stringify({
      name: FILE_NAME,
      ...(!file && { parents: ['appDataFolder'] }),
    });
    const body = new FormData();
    body.append('metadata', new Blob([metadata], { type: 'application/json' }));
    body.append('file', new Blob([data as unknown as ArrayBuffer], { type: 'application/octet-stream' }));

    const res = await fetch(
      file
        ? `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=multipart`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
      {
        method: file ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      },
    );

    if (res.ok && isCurrent()) {
      localStorage.setItem(key, String(Date.now()));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Full sync: merge any existing Drive backup into the local DB first, then
 * upload the merged result. A failed read or merge must never overwrite it.
 *
 * This is the only sync entry point needed. It replaces the old
 * downloadIfNewer + uploadToDrive pair and is safe to call at any point after
 * openDatabase() has returned.
 *
 * Background syncs (Layout visibility/online, end-of-session upload) must never
 * trigger interactive auth, so they use only an already-valid stored token.
 * Explicit user actions pass allowRefresh to attempt a silent refresh, and a
 * fresh login passes tokenOverride to skip the lookup entirely.
 */
async function performSync(
  opts: { tokenOverride?: string; allowRefresh?: boolean } = {},
): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const db = getDb();
    const user = getCurrentUser();
    const key = syncKey();
    const isCurrent = () => {
      try {
        return getDb() === db && getCurrentUser() === user && getCurrentLanguage() === 'sw' && syncKey() === key;
      } catch { return false; }
    };
    if (!isCurrent()) return false;
    const token = opts.tokenOverride ?? (opts.allowRefresh ? await getOrRefreshToken() : getGoogleToken());
    if (!token || !isCurrent()) return false;
    const file = await findFile(token);
    if (!isCurrent()) return false;

    // Always merge an existing backup. Device clocks and a local success time
    // cannot reliably identify whether another device has written new progress.
    if (file) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return false;
      const remoteBytes = new Uint8Array(await res.arrayBuffer());
      if (!isCurrent()) return false;
      const result = await mergeRemoteDb(remoteBytes);
      if (!result.merged || !isCurrent()) return false;
      await flushDatabase();
    }

    // Upload current local state (whether we merged or not)
    return _upload(token, file, isCurrent, key);
  } catch {
    return false;
  }
}

// Visibility, online and manual events can overlap. Only one read/merge/write
// cycle may run at once, including the first backup creation.
let syncInFlight: Promise<boolean> | null = null;
export function syncWithDrive(opts: { tokenOverride?: string; allowRefresh?: boolean } = {}): Promise<boolean> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = performSync(opts).finally(() => { syncInFlight = null; });
  return syncInFlight;
}

// Kept for the Settings "Sync now" button — delegates to syncWithDrive so
// it also merges any remote changes the user might have made on another device.
export async function uploadToDrive(): Promise<boolean> {
  return syncWithDrive({ allowRefresh: true });
}

export function getLastSyncTime(): Date | null {
  const t = localStorage.getItem(syncKey());
  return t ? new Date(Number(t)) : null;
}

export function clearSyncState(): void {
  localStorage.removeItem(syncKey());
}
