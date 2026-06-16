# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

> Extends `~/.Codex/AGENTS.md` (global Karpathy principles: Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution). Those rules apply here in full.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Type-check (tsc) then bundle (vite build)
npm run preview  # Preview production build locally
```

There is no test suite. The build command (`tsc && vite build`) is the primary correctness check — TypeScript errors fail the build.

The app **must** be served over HTTP (not opened as a file) because WebAssembly and IndexedDB require an HTTP origin.

## Architecture

### Tech Stack
React 18 + TypeScript, React Router 6, Tailwind CSS, Zustand, sql.js (SQLite over WebAssembly), FSRS spaced repetition algorithm, Vite 5, vite-plugin-pwa (Workbox). Deployed on Vercel as a static site.

### Future Architecture Direction
The current architecture is intentionally a no-cost, local-first PWA for personal use and friend testing. Do not prematurely rewrite it into a cloud-first app while the learning experience is still being validated.

If the app grows into a broader cross-platform product, the preferred direction is:
- Keep the learning engine local-first and offline-capable.
- Serve curriculum as downloadable language/unit packs.
- Store shared curriculum once, not cloned per user in the cloud.
- Sync only user progress deltas: review logs, card states, sessions, settings, stars, unit progress, skill mastery.
- Use a backend such as Convex for auth, sync, user progress, and admin tooling.
- Avoid making live cloud queries required for ordinary study sessions.

### Native App Direction
Preferred native path is Capacitor first, not a React Native rewrite. Capacitor should allow the existing React/Vite app to run inside native iOS and Android shells while preserving the same offline learning engine.

Keep algorithms, scheduling, curriculum loading, sync, and persistence boundaries modular so they can survive a future Capacitor wrapper. Avoid scattering browser-only APIs through screens; isolate platform-specific storage/auth/network behavior behind small adapters where practical.

Only consider a full React Native rewrite if Capacitor cannot meet performance, storage, offline, accessibility, or app-store requirements.

### Database Layer (`src/database/db.ts`)
The entire database is a single file: sql.js (SQLite in WebAssembly) backed by IndexedDB. There is no server.

- **Per-user isolation**: Each username gets its own SQLite DB stored in IndexedDB under key `db_<username>`.
- **Template clone**: On first open for a user, `/swahili_default.db` (served from `public/`) is fetched and copied into IndexedDB.
- **Singleton pattern**: `_db` and `_currentUser` are module-level. Call `openDatabase(username)` before any query. `getDb()` throws if called before this.
- **Write-through**: Every write calls `scheduleFlush()`, which debounces `_db.export()` → `idbSave()` at 500 ms.
- **Migrations**: `openDatabase()` runs idempotent `CREATE TABLE IF NOT EXISTS` and try/catch `ALTER TABLE` statements on every open. New schema additions go here.
- **All queries live in `db.ts`** — screens call exported async functions, never touching sql.js directly.

### SRS Pipeline
When a user submits a rating, the flow is:

1. **`sessionStore.ts`** (`submitRating`) receives the rating (1–5).
2. Maps rating to FSRS rating (1–4) and calls `processReview()` from `src/algorithms/fsrs.ts`.
3. `computeNewDepthLevel()` maps the resulting interval to a `DepthLevel` (1 → 2 → 3 → 4 → 5.1–5.3).
4. Applies a response-time multiplier (±15%) from rolling per-card average, skipped for `fill_blank`.
5. Writes `card_states`, `review_logs`, `skill_mastery`, and optionally `error_patterns` via `db.ts`.
6. Calls `drawWeightedCard()` to select the next card.

### Session Assembly (`src/scheduling/sessionAssembly.ts`)
Card weight = `depthWeight(depth) × timeFraction(card, nowMs)`. Shallower depth and approaching due date both increase weight. ITS modifiers layer on top: error-rate boost per skill tag (C-01), goal-priority multipliers (C-06, from `src/utils/goalWeights.ts`), starred-card boost (D-04). `loadSessionModifiers()` reads skill mastery from DB once per session.

### Exercise Selection (`src/screens/LearnScreen.tsx` — `pickExercise`)
Exercise type is chosen per-card from scaffold level (1–5 from `src/algorithms/afm.ts`):
- Level 5 → `flashcard` (new/unknown card)
- Level 3–4 → `multiple_choice`
- Level 1–2 → `type_answer`

Grammar cards with `___` → `fill_blank`. Grammar and phrase cards are capped at `multiple_choice` (can't reasonably type multi-part answers). User settings (`disable_type_answer`, `disable_flashcard`) fall back up the ladder.

### Unit Lesson Flow (`src/screens/UnitLessonScreen.tsx`)
Phases: `grammar` → `words` → `practice` → `results`. Cards per lesson = 8 (`CARDS_PER_LESSON` in `src/utils/lessons.ts`), sorted by `frequency_rank`. A lesson unlocks when all cards in the previous lesson reach `depth_level >= 2`. The lesson only completes when every card gets a correct answer in the practice phase.

### Zustand Store (`src/store/sessionStore.ts`)
Single store for the active learn session. Holds `pool` (all available cards), `current` (card being shown), and `reviews` (completed this session). `finishSession()` writes the session record and triggers a Google Drive upload.

### Google Drive Sync (`src/sync/driveSync.ts`)
Optional. Stores one file (`swahili.db`) in the user's Google Drive `appDataFolder`. Downloads if Drive copy is newer than `localStorage` timestamp; uploads after each session. Auth token stored in `localStorage` via `src/auth/googleAuth.ts`.

### Routing
`/` → `UserPickerScreen` → `/onboarding` → `/placement-test` → `/app/*` (wrapped in `Layout` with bottom tab nav). `Layout` checks `sessionStorage` for `currentUser` and calls `openDatabase()` on reload; redirects to `/` if missing.

### Key Conventions
- `@/` alias maps to `src/` (configured in `vite.config.ts`).
- All DB access is async (sql.js runs synchronously but the IDB persistence layer is async).
- `src/types.ts` is the single source of truth for all shared types — screens and algorithms import from here.
- Migrations are always additive (no destructive ALTER TABLE). New columns use `INSERT OR IGNORE` or try/catch patterns.
- The `public/swahili_default.db` template is the seed database and the **source of truth** — it contains all cards, units, and initial card states. There is no external generator or build pipeline. Change curriculum content by editing this file directly with a one-off Node script (see `scripts/*.cjs`, which open it via `sql.js`, transform rows, and write it back). When a content fix must also reach users who already cloned the DB into IndexedDB, mirror it as an idempotent migration in `src/database/` (e.g. `grammarFixes.ts`, wired into the version-gated migrations in `db.ts`).
