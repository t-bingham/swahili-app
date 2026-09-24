import { beforeEach, afterEach, expect, it, vi } from 'vitest';

let callback: (response: Record<string, string>) => void;
const storage = new Map<string, string>();

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client');
  storage.clear();
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal('window', { google: { accounts: { oauth2: { initTokenClient: (config: { callback: typeof callback }) => {
    callback = config.callback;
    return { requestAccessToken: vi.fn() };
  } } } } });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('ignores an old-account token callback after switching accounts', async () => {
  const auth = await import('../src/auth/googleAuth');
  auth.saveGoogleSession('expired', 0, { email: 'a@example.test', name: 'A', picture: '' });
  const pending = auth.getOrRefreshToken();
  auth.clearGoogleSession();
  auth.saveGoogleSession('new-account-token', 3600, { email: 'b@example.test', name: 'B', picture: '' });
  callback({ access_token: 'old-account-token', expires_in: '3600' });
  expect(await pending).toBeNull();
  expect(auth.getGoogleToken()).toBe('new-account-token');
  expect(auth.getGoogleProfile()?.email).toBe('b@example.test');
});

it('ignores a token callback arriving after the refresh timeout', async () => {
  const auth = await import('../src/auth/googleAuth');
  auth.saveGoogleSession('expired', 0, { email: 'a@example.test', name: 'A', picture: '' });
  const pending = auth.getOrRefreshToken();
  await vi.advanceTimersByTimeAsync(5000);
  expect(await pending).toBeNull();
  callback({ access_token: 'late-token', expires_in: '3600' });
  expect(auth.getGoogleToken()).toBeNull();
});
