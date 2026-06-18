# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

> Extends `~/.Codex/AGENTS.md` (global Karpathy principles: Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution). Those rules apply here in full.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Type-check (tsc) then bundle (vite build)
npm run test     # Run Vitest regression tests
npm run preview  # Preview production build locally
```

The app must be served over HTTP, not opened as a file, because WebAssembly and IndexedDB require an HTTP origin. Use `http://localhost:5173` for local browser testing because that origin is permitted for Google OAuth.

`npm run build` is still the primary release gate. The Vitest suite covers regression boundaries for scheduling, database migrations, language adapters, platform readiness, and utility behavior.

## Architecture

### Tech Stack

React 18 + TypeScript, React Router 6, Tailwind CSS, Zustand, sql.js (SQLite over WebAssembly), FSRS spaced repetition algorithm, Vite 5, vite-plugin-pwa (Workbox). Deployed on Vercel as a static site.

### Product Direction

The current architecture is intentionally a no-cost, local-first PWA for personal use and friend testing. Do not prematurely rewrite it into a cloud-first app while the learning experience is still being validated.

If the app grows into a broader cross-platform product, the preferred direction is:

- Keep the learning engine local-first and offline-capable.
- Serve curriculum as downloadable language/unit packs.
- Store shared curriculum once, not cloned per user in the cloud.
- Sync only user progress deltas: review logs, card states, sessions, settings, stars, unit progress, skill mastery, and review notes.
- Use a backend such as Convex later for auth, sync, user progress, reviewer/admin tooling, analytics, and curriculum publishing.
- Avoid making live cloud queries required for ordinary study sessions.

### Native App Direction

Preferred native path is Capacitor first, not a React Native rewrite. Capacitor should allow the existing React/Vite app to run inside native iOS and Android shells while preserving the same offline learning engine.

Platform-sensitive browser APIs should stay behind wrappers:

- File export: `src/platform/fileExport.ts`
- Speech/TTS: `src/platform/speech.ts`
- Platform readiness map: `src/platform/capabilities.ts`
- Sync provider boundary: `src/sync/syncService.ts`

See `CAPACITOR_READINESS.md` before adding native dependencies. Only consider a full React Native rewrite if Capacitor cannot meet performance, storage, offline, accessibility, or app-store requirements.

### Database Layer (`src/database/db.ts`)

The database is sql.js (SQLite in WebAssembly) backed by IndexedDB. There is no server.

- **Per-user/language isolation**: Swahili keeps the legacy key `db_<username>`. Other languages use `db_<lang>_<username>`.
- **Template clone**: On first open for a user+language, the language config's `templateDb` is fetched from `public/` and copied into IndexedDB.
- **Singleton pattern**: `_db`, `_currentUser`, and `_currentLanguage` are module-level. Call `openDatabase(username, lang)` before any query. `getDb()` throws if called before this.
- **Write-through**: Every write calls `scheduleFlush()`, which debounces `_db.export()` to IndexedDB at 500 ms.
- **Migrations**: `openDatabase()` calls `runMigrations(_db, lang)` from `src/database/migrations.ts`. Migrations are version-gated, additive, and may be language-scoped.
- **Curriculum install metadata**: `curriculum_packages` and `curriculum_unit_versions` record installed language/unit package metadata for future downloadable packs.
- **All queries live in `db.ts`**: screens call exported async functions, never touching sql.js directly.

### Curriculum Source of Truth

The seed template DBs in `public/` are the current source of truth for shipped curriculum. Swahili's original seed is `public/swahili_default.db`; Korean and Maori use their own template DBs via `src/data/languages.ts`.

Change curriculum content by editing the relevant seed DB with a one-off Node script (see `scripts/*.cjs`, which open DBs through `sql.js`, transform rows, and write the file back). When a content fix must also reach users who already cloned a DB into IndexedDB, mirror it as an idempotent migration in `src/database/migrations.ts` or a helper wired into that migration registry.

### Curriculum Review

The in-app curriculum review flow lives at `/app/review` in `src/screens/ReviewScreen.tsx`.

- Reviewable generated/reviewed cards come from `getReviewQueue()`.
- A selected card can be opened with `/app/review?card=<card_id>`.
- Accepted card edits use `saveReviewedCard()`.
- Audit notes use `review_notes` via `saveReviewNote()`, `getReviewNotesForCard()`, and `exportReviewNotes()`.
- Notes are append-only during Drive merge.
- Correction JSON exports and review-note JSON exports are meant to feed the seed DB update process.

### Language Adapter Layer

Language-specific behavior belongs in `src/languages/`, not in generic screens.

- Adapter contract: `src/languages/types.ts`
- Adapter registry: `src/languages/index.ts`
- Shared fallback behavior: `src/languages/shared.ts`
- Swahili adapter: `src/languages/sw.ts`
- Korean adapter: `src/languages/ko.ts`
- Maori adapter: `src/languages/mi.ts`
- Shared Swahili concord parser: `src/languages/swahiliConcord.ts`

Adapters own grammar hints, scaffold hints, structural error classification, target/English labels, TTS language prefixes, and special exercise candidates. Future languages should start with the base adapter and add capability-specific behavior as metadata matures.

### SRS Pipeline

When a user submits a rating, the flow is:

1. `sessionStore.ts` (`submitRating`) receives the rating (1-5).
2. Maps rating to FSRS rating (1-4) and calls `processReview()` from `src/algorithms/fsrs.ts`.
3. `computeNewDepthLevel()` maps the resulting interval to a `DepthLevel`.
4. Applies a response-time multiplier (+/-15%) from rolling per-card average, skipped for `fill_blank`.
5. Writes `card_states`, `review_logs`, `skill_mastery`, and optionally `error_patterns` via `db.ts`.
6. Calls `drawWeightedCard()` to select the next card.

### Session Assembly (`src/scheduling/sessionAssembly.ts`)

Card weight = `depthWeight(depth) * timeFraction(card, nowMs)`. Shallower depth and approaching due date both increase weight. ITS modifiers layer on top: error-rate boost per skill tag, goal-priority multipliers from `src/utils/goalWeights.ts`, and starred-card boost. `loadSessionModifiers()` reads skill mastery from DB once per session.

### Exercise Selection (`src/screens/LearnScreen.tsx` - `pickExercise`)

Exercise type is chosen per-card from scaffold level (1-5 from `src/algorithms/afm.ts`):

- Level 5 -> `flashcard` (new/unknown card)
- Level 3-4 -> `multiple_choice`
- Level 1-2 -> `type_answer`

Grammar cards with `___` become `fill_blank`. Grammar and phrase cards are capped at `multiple_choice`. User settings (`disable_type_answer`, `disable_flashcard`) fall back up the ladder. Language-specific special exercises are requested from `language.specialExercises(...)`, not hard-coded per language in `LearnScreen`.

### Unit Lesson Flow (`src/screens/UnitLessonScreen.tsx`)

Phases: `grammar` -> `words` -> `practice` -> `results`. Cards per lesson = 8 (`CARDS_PER_LESSON` in `src/utils/lessons.ts`), sorted by `frequency_rank`. A lesson unlocks when all cards in the previous lesson reach `depth_level >= 2`. The lesson only completes when every card gets a correct answer in the practice phase.

### Zustand Store (`src/store/sessionStore.ts`)

Single store for the active learn session. Holds `pool` (all available cards), `current` (card being shown), and `reviews` (completed this session). `finishSession()` writes the session record and flushes the local DB. `LearnScreen` triggers background sync after ending a session through `syncService`.

### Sync

App code should import from `src/sync/syncService.ts`, not directly from `driveSync.ts`.

- `syncService.ts` defines the provider-neutral sync boundary.
- `driveSync.ts` is the current Google Drive provider implementation.
- Google Drive stores one file (`swahili.db`) in the user's Drive `appDataFolder`.
- Drive sync currently supports Swahili only to preserve the legacy backup shape.
- `exportLocalProgressChanges()` in `db.ts` is the compact progress boundary intended for future delta sync and Convex.
- `FUTURE_CONVEX_COLLECTIONS` in `syncService.ts` documents the likely backend model.

### Routing

`/` -> `UserPickerScreen` -> `/onboarding` -> `/placement-test` -> `/app/*` (wrapped in `Layout` with bottom tab nav). `Layout` checks `sessionStorage` for `currentUser` and calls `openDatabase()` on reload; redirects to `/` if missing.

### Key Conventions

- `@/` alias maps to `src/` (configured in `vite.config.ts`).
- All DB access is async, even though sql.js itself runs synchronously.
- `src/types.ts` is the single source of truth for shared app types.
- Migrations are always additive. Do not use destructive schema migrations.
- Keep generic screens language-neutral. Use adapters for language-specific behavior.
- Keep platform-specific browser APIs behind `src/platform/` wrappers when practical.
- After architecture changes, run `npm run test`, `npm run build`, and `git diff --check`.
