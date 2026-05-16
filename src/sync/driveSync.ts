import { getDb } from '../database/db';
import { getGoogleToken, getGoogleProfile } from '../auth/googleAuth';

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

// Downloads the DB from Drive if the Drive copy is newer than the last sync.
// Returns null if offline, token expired, no Drive file, or already up to date.
export async function downloadIfNewer(token: string): Promise<Uint8Array | null> {
  if (!navigator.onLine) return null;
  try {
    const file = await findFile(token);
    if (!file) return null;

    const driveMs  = new Date(file.modifiedTime).getTime();
    const lastSync = Number(localStorage.getItem(syncKey()) ?? 0);
    if (driveMs <= lastSync) return null;

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Uploads the current in-memory DB to Drive. Called after each session ends.
export async function uploadToDrive(): Promise<boolean> {
  const token = getGoogleToken();
  if (!token || !navigator.onLine) return false;
  try {
    const data = getDb().export();
    const file = await findFile(token);

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

export function getLastSyncTime(): Date | null {
  const t = localStorage.getItem(syncKey());
  return t ? new Date(Number(t)) : null;
}

export function clearSyncState(): void {
  localStorage.removeItem(syncKey());
}
