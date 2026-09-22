# App review — 23 September 2026

Reviewed routing and onboarding, authentication and profile switching, local SQLite persistence and migrations, Drive sync, scheduling and practice, unit lessons, gallery/review tooling, statistics, platform wrappers, and PWA build configuration. This is a code review with focused browser smoke tests, not a linguistic audit of every curriculum card or a full device compatibility certification.

## Fixes in this PR

- Drive lookup, download, merge, or persistence failures now stop the upload instead of creating duplicate backups or overwriting unread remote progress. Overlapping sync calls share one operation. The operation checks the active database, language, and account before merging or uploading.
- Existing Drive backups are always merged before upload. Comparing a server modification timestamp with a device's wall clock could skip newer remote progress. This trades additional download work for safer merges.
- Corrected the forgetting curve and its inverse interval formula. Stability now corresponds to 90% recall, rather than approximately 41%. Regression tests cover the anchor and several requested retention levels. The equations are documented in the [upstream FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm/9f693608f651bf27d742082f868e27c5e12dafe0#fsrs-45). Existing stored schedules are unchanged until the next review.
- Onboarding and placement routes restore the database before rendering after reload. Onboarding saves flush before navigation.
- A repeated card in a one-card session now starts a fresh exercise and hides its old answer. Ending practice cancels pending answer feedback.
- Lesson navigation resets word/practice indices and results, rejects locked lesson URLs, and cancels feedback timers when the exercise unmounts. Repeating an earlier lesson preserves a completed unit's status and completion date. Successful lesson writes flush before results.
- Account and language exits reset the practice store. Signing out clears the session's user and the correct account's sync timestamp. Failed Google user-info responses are rejected before saving a session.

## Verification

- `npm.cmd run test`: 59 tests passed, including 11 Drive regression cases, 7 additional FSRS cases, and migration/integrity/idempotence checks against all three shipped language databases.
- `npm.cmd run build`: TypeScript, Vite, and PWA generation passed.
- `git diff --check`: passed.
- Browser checks used a separate local test profile: onboarding reload, immediate profile persistence after completed onboarding, placement reload, unit map, repeated single-card practice, saved statistics, gallery search/starred filtering, switching to Korean onboarding, and Maori database initialization/onboarding.
- Live Google OAuth/Drive round trips, simultaneous writes from separate devices, native shells, speech voices, and offline service-worker update behavior were not exercised. Sync network failures are covered by mocked responses. No production profile or remote backup was used for testing.

## Remaining findings

1. **High: account-key collisions.** `googleUsername()` uses only a sanitized email local part. Accounts such as `alex@example.com` and `alex@another.example` share a key; punctuation can also collide. A future change should use a stable full identity and migrate legacy data with explicit ownership information. Blindly renaming or copying existing databases could assign progress to the wrong account, so this review does not attempt that migration.
2. **Medium: cross-device sync conflicts.** The current whole-file read/merge/write protocol has no conditional write protection across devices or tabs. Two devices can still race after downloading the same version. Card-state conflict resolution also prefers the higher review count, and starred flags use OR semantics, so an unstar can be resurrected. The new in-process sync guard does not solve these protocol issues.
3. **Medium: lesson completion coverage.** Unit lessons deliberately exclude fill-in-the-blank grammar cards from their multiple-choice practice pool and introduce all lesson cards on success. A lesson containing only these cards can therefore complete without a graded answer. Completing the intended all-card mastery rule needs an explicit fill-blank lesson exercise path, not simply removing the filter.
4. **Medium: local storage lifecycle.** Database open/close operations are not serialized, IndexedDB connections are not closed after each transaction, and debounced persistence has no user-facing storage failure state. Rapid profile/language switching and quota failures deserve dedicated persistence integration tests and a focused lifecycle change.
5. **Low: daily boundaries.** Daily statistics and activity use UTC dates, which may differ from the learner's local day. Define a consistent local-day policy before changing stored date semantics.

The app remains local-first. These changes add no backend, paid service, native dependency, or curriculum rewrite.
