import type { ProfileSettings } from '../types';

export function applyDisplaySettings(settings: Partial<ProfileSettings>): void {
  const html = document.documentElement;
  html.classList.toggle('large-text',    settings.large_text    === true);
  html.classList.toggle('high-contrast', settings.high_contrast === true);
}
