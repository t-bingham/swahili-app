const TOKEN_KEY   = 'g_token';
const EXPIRY_KEY  = 'g_expiry';
const PROFILE_KEY = 'g_profile';
const REFRESH_KEY = 'g_refresh';

export interface GoogleProfile {
  name: string;
  email: string;
  picture: string;
}

export function saveGoogleSession(
  token: string,
  expiresIn: number,
  profile: GoogleProfile,
  refreshToken?: string,
): void {
  localStorage.setItem(TOKEN_KEY, token);
  // Subtract 60 s so we treat it as expired slightly before it actually is
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + (expiresIn - 60) * 1000));
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  // Always write/clear the refresh token slot so stale tokens from a previous
  // auth-code flow session don't cause failed refresh attempts later.
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_KEY);
  }
}

export function getGoogleToken(): string | null {
  const token  = localStorage.getItem(TOKEN_KEY);
  const expiry = Number(localStorage.getItem(EXPIRY_KEY) ?? 0);
  if (!token || Date.now() > expiry) return null;
  return token;
}

export function getGoogleProfile(): GoogleProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Attempt a silent token refresh using the GIS token client (already loaded by
// @react-oauth/google). Uses prompt:'' so no UI appears — if the user's Google
// session is still alive the new token arrives in a few hundred ms. Resolves
// null on any error or if the 5-second window expires.
function trySilentRefresh(): Promise<string | null> {
  const clientId = (import.meta as unknown as { env: Record<string, string> }).env.VITE_GOOGLE_CLIENT_ID;
  const gis = (window as unknown as {
    google?: { accounts?: { oauth2?: { initTokenClient: (cfg: Record<string, unknown>) => { requestAccessToken: (o?: Record<string, unknown>) => void } } } }
  }).google?.accounts?.oauth2;

  if (!clientId || !gis) return Promise.resolve(null);

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 5_000);

    try {
      const client = gis.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.appdata',
        callback: (resp: Record<string, string>) => {
          clearTimeout(timer);
          if (resp.access_token && !resp.error) {
            const profile = getGoogleProfile();
            if (profile) saveGoogleSession(resp.access_token, Number(resp.expires_in) || 3600, profile);
            resolve(resp.access_token);
          } else {
            resolve(null);
          }
        },
        error_callback: () => { clearTimeout(timer); resolve(null); },
      });
      client.requestAccessToken({ prompt: '' });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

// Returns a valid access token. If the stored token is expired, attempts a
// silent GIS refresh. Returns null if offline or the silent refresh fails
// (caller should degrade gracefully).
export async function getOrRefreshToken(): Promise<string | null> {
  const token = getGoogleToken();
  if (token) return token;
  if (!navigator.onLine) return null;
  return trySilentRefresh();
}

export function clearGoogleSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// Signed in means we have a saved profile (token may be expired — use getOrRefreshToken).
export function isGoogleSignedIn(): boolean {
  return getGoogleProfile() !== null;
}

// Derives a safe local username from the Google email (e.g. "tom.b@gmail.com" → "tom_b")
export function googleUsername(profile: GoogleProfile): string {
  return profile.email.split('@')[0].replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
