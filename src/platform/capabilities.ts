export type PlatformArea =
  | 'storage'
  | 'auth'
  | 'audio'
  | 'file_export'
  | 'offline_cache'
  | 'notifications';

export interface PlatformCapability {
  area: PlatformArea;
  webImplementation: string;
  capacitorConcern: string;
  likelyPlugin: string | null;
  isolated: boolean;
}

export const PLATFORM_CAPABILITIES: PlatformCapability[] = [
  {
    area: 'storage',
    webImplementation: 'sql.js persisted through IndexedDB',
    capacitorConcern: 'IndexedDB usually works in WebView, but large SQLite snapshots may need filesystem-backed storage later.',
    likelyPlugin: '@capacitor/filesystem',
    isolated: false,
  },
  {
    area: 'auth',
    webImplementation: 'Google OAuth implicit flow plus localStorage token cache',
    capacitorConcern: 'Native builds usually need a native Google sign-in flow and redirect handling.',
    likelyPlugin: '@codetrix-studio/capacitor-google-auth or equivalent',
    isolated: false,
  },
  {
    area: 'audio',
    webImplementation: 'Web Speech API',
    capacitorConcern: 'Speech voices vary by platform; native text-to-speech may be needed for reliable offline audio.',
    likelyPlugin: '@capacitor-community/text-to-speech',
    isolated: true,
  },
  {
    area: 'file_export',
    webImplementation: 'Blob download through an anchor element',
    capacitorConcern: 'Native apps need share-sheet or filesystem export instead of browser downloads.',
    likelyPlugin: '@capacitor/share or @capacitor/filesystem',
    isolated: true,
  },
  {
    area: 'offline_cache',
    webImplementation: 'Vite PWA service worker plus bundled DB/WASM assets',
    capacitorConcern: 'Packaged native assets do not depend on a service worker, but update strategy changes.',
    likelyPlugin: null,
    isolated: false,
  },
  {
    area: 'notifications',
    webImplementation: 'none',
    capacitorConcern: 'Daily review reminders need native notification permissions and scheduling.',
    likelyPlugin: '@capacitor/local-notifications',
    isolated: false,
  },
];

export function getCapacitorReadinessSummary(): { isolated: PlatformArea[]; needsBoundary: PlatformArea[] } {
  return {
    isolated: PLATFORM_CAPABILITIES.filter(c => c.isolated).map(c => c.area),
    needsBoundary: PLATFORM_CAPABILITIES.filter(c => !c.isolated).map(c => c.area),
  };
}
