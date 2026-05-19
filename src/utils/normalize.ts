/** Lowercases, trims, and strips non-alphanumeric-space characters. */
export function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}
