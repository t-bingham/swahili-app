import { getDb, getCurrentUser, getCurrentLanguage, mergeRemoteDb, flushDatabase } from '../database/db';
import { getOrRefreshToken, getGoogleToken, getGoogleProfile } from '../auth/googleAuth';
import { googleUsername } from '../auth/profileIdentity';

const FILE_NAME = 'swahili.db';

function syncKey(): string {
  const profile = getGoogleProfile();
  return profile ? `drive_last_sync_${profile.email}` : 'drive_last_sync';
}

interface DriveFile { id: string; etag: string }

// Drive v2 exposes the resource ETag explicitly. Keep read and conditional
// write on the same API version; never fall back to an unconditional update.
async function findFiles(token: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      spaces: 'appDataFolder', q: "title = '" + FILE_NAME + "' and trashed = false",
      fields: 'nextPageToken,items(id,etag)', maxResults: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await fetch('https://www.googleapis.com/drive/v2/files?' + params, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!response.ok) throw new Error('Could not look up the Drive backup');
    const json = await response.json();
    if (!Array.isArray(json.items)) throw new Error('Invalid Drive file listing');
    for (const file of json.items) {
      if (typeof file.id !== 'string' || typeof file.etag !== 'string' || !file.etag) throw new Error('Backup has no conflict token');
      files.push(file);
    }
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return files.sort((a,b) => a.id.localeCompare(b.id));
}

async function upload(token: string, file?: DriveFile): Promise<Response> {
  const data = getDb().export();
  if (file) {
    return fetch('https://www.googleapis.com/upload/drive/v2/files/' + encodeURIComponent(file.id) + '?uploadType=media', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'If-Match': file.etag, 'Content-Type': 'application/octet-stream' },
      body: new Blob([data as unknown as ArrayBuffer]),
    });
  }
  const boundary = 'swahili-' + crypto.randomUUID();
  const metadata = JSON.stringify({ title: FILE_NAME, parents: [{ id: 'appDataFolder' }] });
  const body = new Blob([
    '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + metadata + '\r\n',
    '--' + boundary + '\r\nContent-Type: application/octet-stream\r\n\r\n',
    data as unknown as ArrayBuffer,
    '\r\n--' + boundary + '--',
  ], { type: 'multipart/related; boundary=' + boundary });
  return fetch('https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }, body,
  });
}

/** Read/merge/conditional-write. On conflict, download again before retrying. */
async function performSync(opts: { tokenOverride?: string; allowRefresh?: boolean } = {}): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const db = getDb();
    const user = getCurrentUser();
    const profile = getGoogleProfile();
    if (!profile || user !== googleUsername(profile)) return false;
    const key = syncKey();
    const isCurrent = () => {
      try { return getDb() === db && getCurrentUser() === user && getCurrentLanguage() === 'sw' && syncKey() === key; }
      catch { return false; }
    };
    if (!isCurrent()) return false;
    const token = opts.tokenOverride ?? (opts.allowRefresh ? await getOrRefreshToken() : getGoogleToken());
    if (!token || !isCurrent()) return false;

    for (let attempt = 0; attempt < 3; attempt++) {
      const files = await findFiles(token);
      if (!isCurrent()) return false;
      let conflict = false;
      // Simultaneous first syncs can create same-name files. Merge EVERY copy
      // before updating a deterministic canonical file; retain recovery copies.
      for (const file of files) {
        const response = await fetch('https://www.googleapis.com/drive/v2/files/' + encodeURIComponent(file.id) + '?alt=media', {
          headers: { Authorization: 'Bearer ' + token, 'If-Match': file.etag },
        });
        if (response.status === 412) { conflict = true; break; }
        if (!response.ok) return false;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!isCurrent()) return false;
        const result = await mergeRemoteDb(bytes);
        if (!result.merged || !isCurrent()) return false;
      }
      if (conflict) continue;
      await flushDatabase();
      if (!isCurrent()) return false;
      const response = await upload(token, files[0]);
      if (response.status === 412) continue;
      if (!response.ok || !isCurrent()) return false;
      localStorage.setItem(key, String(Date.now()));
      return true;
    }
    return false; // Leave local changes intact for the next explicit/background retry.
  } catch { return false; }
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
