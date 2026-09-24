export function googleUsername(profile: { email: string }): string {
  return `google:${encodeURIComponent(profile.email.trim().toLowerCase())}`;
}

export function legacyGoogleUsername(profile: { email: string }): string {
  return profile.email.split('@')[0].replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
