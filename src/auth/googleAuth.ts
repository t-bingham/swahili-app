const TOKEN_KEY   = 'g_token';
const EXPIRY_KEY  = 'g_expiry';
const PROFILE_KEY = 'g_profile';

export interface GoogleProfile {
  name: string;
  email: string;
  picture: string;
}

export function saveGoogleSession(token: string, expiresIn: number, profile: GoogleProfile): void {
  localStorage.setItem(TOKEN_KEY, token);
  // Subtract 60 s so we treat it as expired slightly before it actually is
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + (expiresIn - 60) * 1000));
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
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

export function clearGoogleSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

export function isGoogleSignedIn(): boolean {
  return getGoogleToken() !== null && getGoogleProfile() !== null;
}

// Derives a safe local username from the Google email (e.g. "tom.b@gmail.com" → "tom_b")
export function googleUsername(profile: GoogleProfile): string {
  return profile.email.split('@')[0].replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
