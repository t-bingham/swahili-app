# Capacitor Readiness Notes

The app is still a web/PWA build. Phase 6 does not install Capacitor; it isolates the browser APIs most likely to change when the app is packaged for iOS and Android.

## Current Boundaries

- File export lives in `src/platform/fileExport.ts`.
- Speech synthesis lives in `src/platform/speech.ts`.
- Platform capability tracking lives in `src/platform/capabilities.ts`.
- Sync provider selection lives in `src/sync/syncService.ts`.

## Likely Native Work

- Storage: IndexedDB should work in WebView, but large SQLite snapshots may eventually need filesystem-backed storage.
- Auth: Google OAuth implicit flow will likely need native Google sign-in or redirect handling.
- Audio: Web Speech availability varies by device; native text-to-speech may be needed for reliable offline voices.
- File export: browser downloads should map to a share sheet or filesystem export.
- Offline cache: packaged assets replace some service-worker assumptions.
- Notifications: daily review reminders require native local notifications.

## Packaging Rule

Before adding Capacitor, keep app code calling platform wrappers instead of browser APIs directly. Add native implementations behind those wrappers one service at a time.
