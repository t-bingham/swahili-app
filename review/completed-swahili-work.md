# Completed Swahili App Review Work (context preserved from the old plan.html)

This file preserves what the previous `plan.html` tracked, before it was rewritten for the
Korean multi-language initiative. All items below are **shipped and on `master`**
(commit `f81ba44`, "App review: content fixes, pedagogy, a11y, audio & maintainability").
Full rationale + sources live in `research.html`; per-area audits in `review/*.md`.

## Phase 0 — Content correctness (BLOCKER, done)
- Regenerated ~4,700 systematically-wrong generated grammar cards from morphological
  components (negative conjugations, adjective concord, ndiyo) directly in the seed DB via
  `scripts/fix-grammar-content.cjs`, mirrored as an idempotent migration in
  `src/database/grammarFixes.ts` (migration v2).
- **Lesson learned (load-bearing for Korean):** LLM-generated curriculum content fails at
  scale in *systematic* ways. Generate from rules where the language is rule-based; validate
  the rest.

## Phase 1 — Correctness / data-integrity bugs (done)
- Fixed `upsertCardState` starred-flag data loss; position-anchored fill-blank extraction;
  Fisher–Yates shuffle in MultipleChoice; Google OAuth refresh popup loop (de-dupe + backoff
  in `googleAuth.ts` / `driveSync.ts`).

## Phase 2 — Pedagogical upgrades (done)
- New exercises: SentenceCloze, ConcordExercise. NounClassReference chart in Grammar tab.
- FSRS target retention 0.88; type-interleaving weight penalty; elaborative rule feedback
  (`grammarRule.ts`); scaffold clamp `depth < 3`.

## Phase 3 — Audio (P3.1 done; P3.2 backlog)
- **P3.1 shipped:** `SpeakButton.tsx` — learner-initiated browser TTS, **off by default**
  (`enable_audio` setting), self-hides unless a Swahili (`sw*`) voice exists (no English
  fallback). Verified live both ways.
- **P3.2 (BACKLOG):** pre-generated cloud-TTS MP3s. Investigated **Google Chirp 3 HD** —
  supports `sw-KE`; whole curriculum is ~340K chars max (word+sentence) vs the 1M chars/month
  free tier, so a one-time batch is **effectively free** (+ $300 trial credit). Blocked only
  on: user must set up the Google Cloud billing account + API key (Claude can't); decide repo
  file-count scope (recommend vocab+phrase ≈ 2,665 clips first, not all 25K cards).

## Phase 4 — Accessibility WCAG 2.1 AA (done)
- Switch semantics on 8 toggles; keyboard-reachable unit/gallery cards; labelled search;
  focus-trapped card-detail dialog (Esc + restore); `motion-reduce` spinner; aria-live
  feedback on NounClass/FlashCard; heatmap `role="img"` summary; contrast lifts
  (`slate-600`→`slate-400` on informational labels only); `aria-hidden` decorative nav emoji.

## Phase 5 — Motivation (done; streaks excluded)
- **NO streaks** — deliberate product decision (see memory `no-streaks`). Honest Stats split
  into Learning (depth 2–2.5) vs Known (depth ≥ 3). Standard-Swahili dialect label
  (Kiunguja / Zanzibar) in Grammar tab + onboarding.

## Phase 6 — Maintainability (done)
- Extracted migrations into an ordered array in `src/database/migrations.ts`
  (**verified byte-identical end-state** old vs new code via full `SELECT *` hash of
  cards/units/card_states). Debounced gallery search (250 ms). Centralised the exercise
  feedback delay in `LearnScreen` (one cancellable timer; exercises report immediately).
  Tidied smells. **Left as-is:** `depthWeight` branches (changing thresholds shifts SRS
  scheduling — not worth the risk for a cosmetic tidy).

## Architecture facts that matter for the Korean work
- Single seed DB `public/swahili_default.db` is the source of truth; per-user clone in
  IndexedDB keyed `db_<username>`; migrations run on every `openDatabase()`.
- The app is **deeply Swahili-coupled**: `swahili` appears ~324× across 32 files (it's the
  card column name); 26 files carry Swahili-specific grammar logic (noun class, concord,
  syllabifier, conjugation, morpheme breakdown) — none of which transfer to Korean.
