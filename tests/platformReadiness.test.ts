import { describe, expect, it } from 'vitest';
import { getCapacitorReadinessSummary, PLATFORM_CAPABILITIES } from '../src/platform/capabilities';

describe('platform readiness boundaries', () => {
  it('tracks Capacitor-sensitive platform areas', () => {
    const areas = PLATFORM_CAPABILITIES.map(capability => capability.area);

    expect(areas).toEqual([
      'storage',
      'auth',
      'audio',
      'file_export',
      'offline_cache',
      'notifications',
    ]);
  });

  it('marks current platform services that have been isolated', () => {
    const summary = getCapacitorReadinessSummary();

    expect(summary.isolated).toEqual(expect.arrayContaining(['audio', 'file_export']));
    expect(summary.needsBoundary).toEqual(expect.arrayContaining(['storage', 'auth', 'offline_cache', 'notifications']));
  });
});
