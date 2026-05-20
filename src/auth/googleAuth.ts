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
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
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

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

// Returns a valid access token, refreshing silently via the backend if needed.
// Returns null if offline, no refresh token saved, or the refresh fails.
export async function getOrRefreshToken(): Promise<string | null> {
  const token = getGoogleToken();
  if (token) return token;

  const refreshToken = getRefreshToken();
  if (!refreshToken || !navigator.onLine) return null;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    const profile = getGoogleProfile();
    if (profile) saveGoogleSession(data.access_token, data.expires_in ?? 3600, profile);
    return data.access_token;
  } catch {
    return null;
  }
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
