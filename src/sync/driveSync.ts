import { getDb, mergeRemoteDb } from '../database/db';
import { getOrRefreshToken, getGoogleToken, getGoogleProfile } from '../auth/googleAuth';

const FILE_NAME = 'swahili.db';

function syncKey(): string {
  const profile = getGoogleProfile();
  return profile ? `drive_last_sync_${profile.email}` : 'drive_last_sync';
}

async function findFile(token: string): Promise<{ id: string; modifiedTime: string } | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27${FILE_NAME}%27&fields=files(id,modifiedTime)`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.files?.[0] ?? null;
  } catch {
    return null;
  }
}

async function _upload(token: string, file: { id: string } | null): Promise<boolean> {
  try {
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

    if (res.ok) {
      localStorage.setItem(syncKey(), String(Date.now()));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Full sync: if Drive has data we haven't seen yet, merge it into the local DB
 * first, then upload the (possibly merged) result back to Drive.
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
export async function syncWithDrive(
  opts: { tokenOverride?: string; allowRefresh?: boolean } = {},
): Promise<boolean> {
  if (!navigator.onLine) return false;
  const token = opts.tokenOverride ?? (opts.allowRefresh ? await getOrRefreshToken() : getGoogleToken());
  if (!token) return false;

  try {
    const file = await findFile(token);
    const lastSync = Number(localStorage.getItem(syncKey()) ?? 0);

    // If Drive has data we haven't merged yet, download and merge it
    if (file && new Date(file.modifiedTime).getTime() > lastSync) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const remoteBytes = new Uint8Array(await res.arrayBuffer());
        await mergeRemoteDb(remoteBytes);
        // file.id is still valid for the upload below — same file, just patching it
      }
    }

    // Upload current local state (whether we merged or not)
    return _upload(token, file);
  } catch {
    return false;
  }
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
