# Changes

## 2026-06-17 Multilingual Learning Expansion

### Context

This session continued the shift from a Swahili-first local learning prototype into a broader multi-language app for friend and family testing. The current architecture remains intentionally low-cost and local-first: React, SQLite via sql.js, IndexedDB persistence, static hosting, and optional Google Drive sync. The longer-term direction is documented as React plus a local-first offline model, with Capacitor as the likely bridge to iOS and Android, and Convex as a possible later sync/backend layer when the app needs accounts, server-side collaboration, analytics, or managed multiplayer-style data flows.

### Planning And Architecture Notes

- Updated `plan.html` into a follow-along implementation plan for multilingual intelligence work.
- Added architecture notes to `AGENTS.md` covering the current no-cost setup and the possible future stack: React, Convex, Capacitor, offline downloadable packs, and sync-on-reconnect behavior.
- Kept the codebase aligned with the existing static/local-first deployment model instead of introducing a server dependency early.

### Curriculum Expansion

- Expanded the Korean and Maori default databases so they are closer to the Swahili database in amount and depth of content.
- Rebuilt:
  - `public/korean_default.db`
  - `public/maori_default.db`
- Improved generated Korean conjugation/content scripts with honorific forms and richer metadata.
- Improved Maori tense/person generation with broader tense and aspect patterns.
- Added a local curriculum review workbook generator and generated workbook:
  - `review/build-curriculum-review-workbook.mjs`
  - `review/curriculum-review.xlsx`

### Language Adapter Layer

- Added a shared language adapter system under `src/languages/`.
- Moved Swahili-specific intelligence out of generic UI and learning flow code.
- Added language-specific adapters for:
  - Swahili
  - Korean
  - Maori
- Centralized target language metadata, speech settings, study direction labels, grammar hints, scaffold hints, error classification, and special exercise selection.

### UI De-Swahilification

- Updated exercise components and learning screens so labels, prompts, answer directions, and speech behavior come from the active language instead of assuming Swahili.
- Updated card gallery, settings, print flashcards, and speak button behavior to use language-aware metadata.

### Grammar Feedback

- Replaced the old Swahili-only grammar rule helper with adapter-driven grammar feedback.
- Added language-aware grammar hints and scaffold hints for Swahili, Korean, and Maori.
- Deleted the old direct `src/utils/grammarRule.ts` path so future languages plug into the adapter layer instead of duplicating one-off helper logic.

### Error Classification

- Reworked error classification so the active language adapter owns language-specific mistake detection.
- Added shared error utility helpers for normalization and token comparison.
- Added Swahili, Korean, and Maori classification support through their adapters.
- Updated session review handling so stored error patterns are language-aware.

### Special Exercises

- Added special exercise support to the shared exercise type model.
- Moved Swahili special exercise selection into the Swahili adapter.
- Added Korean particle practice.
- Added Maori tense/aspect practice.
- Updated the learn screen to render adapter-selected special exercises.

### Metadata And Validation

- Added generated-content metadata validation:
  - `scripts/validate-generated-metadata.cjs`
- Updated Korean and Maori generation scripts to emit normalized tags and parseable conjugation metadata.
- Rebuilt generated databases after metadata changes.

### Review Workflow

- Reworked the review screen for language-aware curriculum review.
- Added review filters for generated cards and card categories.
- Added generated/reviewed counts.
- Added correction patch export so manual review can produce structured fixes later.

### Verification

- TypeScript check passed with `npm.cmd exec tsc -- --noEmit`.
- Generated metadata validation passed with `node scripts\validate-generated-metadata.cjs`.
- Local dev server responded successfully at `http://localhost:5173/`.

### Notes

- A full Vite build was not rerun at the end because the required sandbox escalation became unavailable after earlier approval limits. The TypeScript compiler and metadata validator both passed.
- In-app browser automation was unavailable because the local browser control process hit a Windows permission error. Manual browser access at `http://localhost:5173/` remains the working local test path.
- `.codex-vite.log` and `.codex-vite.err` are now ignored because they are local dev-server artifacts.
