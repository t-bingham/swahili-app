import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb, getCurrentLanguage, mergeRemoteDb, flushDatabase } from '../src/database/db';
import { getGoogleToken, getOrRefreshToken, getGoogleProfile } from '../src/auth/googleAuth';
import { syncWithDrive } from '../src/sync/driveSync';

vi.mock('../src/database/db', () => ({
  getDb: vi.fn(), getCurrentUser: vi.fn(() => 'google:reviewer%40example.test'),
  getCurrentLanguage: vi.fn(() => 'sw'),
  mergeRemoteDb: vi.fn(), flushDatabase: vi.fn(),
}));
vi.mock('../src/auth/googleAuth', () => ({
  getGoogleToken: vi.fn(), getOrRefreshToken: vi.fn(),
  getGoogleProfile: vi.fn(() => ({ email: 'reviewer@example.test' })),
}));

const fetchMock = vi.fn();
const storage = new Map<string, string>();
const listing = () => new Response(JSON.stringify({ items: [{ id: 'backup', etag: '"v1"' }] }));

beforeEach(() => {
  vi.resetAllMocks();
  storage.clear();
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(getDb).mockReturnValue({ export: () => new Uint8Array([1, 2, 3]) } as ReturnType<typeof getDb>);
  vi.mocked(getCurrentLanguage).mockReturnValue('sw');
  vi.mocked(getGoogleProfile).mockReturnValue({ name: 'Review', email: 'reviewer@example.test', picture: '' });
  vi.mocked(getGoogleToken).mockReturnValue('test-token');
  vi.mocked(mergeRemoteDb).mockResolvedValue({ merged: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('Drive sync preserves backups', () => {
  it('uses the downloaded version for conditional writes and re-merges on conflict', async () => {
    fetchMock.mockResolvedValueOnce(listing()).mockResolvedValueOnce(new Response('v1'))
      .mockResolvedValueOnce(new Response('', { status: 412 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: 'backup', etag: '"v2"' }] })))
      .mockResolvedValueOnce(new Response('v2')).mockResolvedValueOnce(new Response('{}'));
    expect(await syncWithDrive()).toBe(true);
    expect(mergeRemoteDb).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[2][1].headers['If-Match']).toBe('"v1"');
    expect(fetchMock.mock.calls[5][1].headers['If-Match']).toBe('"v2"');
  });

  it('bounds conflict retries without recording success', async () => {
    for (let i = 0; i < 3; i++) {
      fetchMock.mockResolvedValueOnce(listing()).mockResolvedValueOnce(new Response('database'))
        .mockResolvedValueOnce(new Response('', { status: 412 }));
    }
    expect(await syncWithDrive()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(storage.size).toBe(0);
  });

  it('merges duplicate first backups from every page before writing the canonical copy', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: 'b', etag: 'b1' }], nextPageToken: 'next' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: 'a', etag: 'a1' }] })))
      .mockResolvedValueOnce(new Response('a')).mockResolvedValueOnce(new Response('b'))
      .mockResolvedValueOnce(new Response('{}'));
    expect(await syncWithDrive()).toBe(true);
    expect(fetchMock.mock.calls[1][0]).toContain('pageToken=next');
    expect(mergeRemoteDb).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[4][0]).toContain('/a?uploadType=media');
  });

  it('refuses unconditional updates if Drive omits its conflict token', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"items":[{"id":"backup"}]}'));
    expect(await syncWithDrive()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a Google account that does not own the active database', async () => {
    vi.mocked(getGoogleProfile).mockReturnValue({ name: 'Other', email: 'other@example.test', picture: '' });
    expect(await syncWithDrive()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500])('does not create a backup when file lookup fails (%s)', async status => {
    fetchMock.mockResolvedValueOnce(new Response('', { status }));
    expect(await syncWithDrive()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storage.size).toBe(0);
  });

  it('does not overwrite a backup when downloading fails', async () => {
    fetchMock.mockResolvedValueOnce(listing()).mockResolvedValueOnce(new Response('', { status: 503 }));
    expect(await syncWithDrive()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mergeRemoteDb).not.toHaveBeenCalled();
  });

  it('does not overwrite an unreadable backup', async () => {
    fetchMock.mockResolvedValueOnce(listing()).mockResolvedValueOnce(new Response('invalid database'));
    vi.mocked(mergeRemoteDb).mockResolvedValueOnce({ merged: false });
    expect(await syncWithDrive()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('merges even when the local clock says it has already synced', async () => {
    storage.set('drive_last_sync_reviewer@example.test', String(Date.now() + 86400000));
    fetchMock.mockResolvedValueOnce(listing()).mockResolvedValueOnce(new Response('database')).mockResolvedValueOnce(new Response('{}'));
    expect(await syncWithDrive()).toBe(true);
    expect(mergeRemoteDb).toHaveBeenCalledTimes(1);
    expect(flushDatabase).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[2][1].method).toBe('PUT');
  });

  it('creates one first backup when callers overlap', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"items":[]}')).mockResolvedValueOnce(new Response('{}'));
    const first = syncWithDrive();
    expect(syncWithDrive()).toBe(first);
    expect(await first).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });

  it('stops if the database changes while a download is pending', async () => {
    fetchMock.mockResolvedValueOnce(listing()).mockImplementationOnce(async () => {
      vi.mocked(getDb).mockReturnValue({ export: vi.fn() } as unknown as ReturnType<typeof getDb>);
      return new Response('database');
    });
    expect(await syncWithDrive()).toBe(false);
    expect(mergeRemoteDb).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops if language changes during token refresh', async () => {
    vi.mocked(getOrRefreshToken).mockImplementationOnce(async () => {
      vi.mocked(getCurrentLanguage).mockReturnValue('ko');
      return 'test-token';
    });
    expect(await syncWithDrive({ allowRefresh: true })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not upload when local persistence fails', async () => {
    fetchMock.mockResolvedValueOnce(listing()).mockResolvedValueOnce(new Response('database'));
    vi.mocked(flushDatabase).mockRejectedValueOnce(new Error('Storage full'));
    expect(await syncWithDrive()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not mark a failed upload as synced and allows a later retry', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"items":[]}')).mockResolvedValueOnce(new Response('', { status: 500 }));
    expect(await syncWithDrive()).toBe(false);
    expect(storage.size).toBe(0);
    fetchMock.mockResolvedValueOnce(new Response('{"items":[]}')).mockResolvedValueOnce(new Response('{}'));
    expect(await syncWithDrive()).toBe(true);
  });
});
