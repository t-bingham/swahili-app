# Code & Accessibility Audit — Swahili Learning App

_Audited 2026-06-15. Read-only — no changes applied._

---

## Summary

The codebase is in good shape overall. The build is clean, TypeScript is strict, and the most critical PLAN.md accessibility items (A-1, A-2, B-1, B-2) have been addressed. Several medium-severity issues remain: toggle buttons throughout Settings lack ARIA semantics (`role="switch"`, `aria-checked`), the `animate-spin` spinner runs unconditionally (no `prefers-reduced-motion` guard), the `upsertCardState` UPSERT silently drops the `starred` column on conflict, `div` elements with `onClick` are used instead of `button` in UnitMapScreen, and the FillInBlank correct-answer extraction is fragile. The migration system has a single version number that cannot be incremented for future changes without auditing all existing migration code, which is a maintainability risk.

---

## Build Status

**PASS — zero errors, zero warnings.**

```
✓ tsc + vite build completed in 1.45s
412 kB main bundle (123 kB gzip)
```

---

## Accessibility Issues

### HIGH

**A-01 — Toggle buttons in SettingsScreen have no ARIA state (`role="switch"` / `aria-checked` missing)**
`src/screens/SettingsScreen.tsx:49–58` (`ToggleRow` component)

The toggle is a `<button>` that visually looks like an iOS switch, but has no ARIA attributes to convey its on/off state to screen readers. A screen reader will announce it as a plain "button" with no label, no value, and no state. Applies to all eight `<ToggleRow>` usages (lines 308, 314, 320, 326, 348, 354, 360, 371).

Fix:
```tsx
<button
  role="switch"
  aria-checked={value}
  aria-label={label}
  onClick={() => onChange(!value)}
  ...
>
```

---

**A-02 — `<div onClick>` used instead of `<button>` for interactive unit cards (not keyboard-reachable)**
`src/screens/UnitMapScreen.tsx:54–73` (`VocabUnitCard`), `src/screens/UnitMapScreen.tsx:104–130` (`GrammarUnitCard`), `src/screens/CardGalleryScreen.tsx:311–339` (`CardItem`)

`<div onClick={...}>` elements are not keyboard-focusable and are invisible to screen readers as interactive controls. Locked cards pass `() => !isLocked && onClick()` to the div, which means they are also not naturally non-interactive.

Fix: Replace the outer `<div>` with `<button type="button">` (or `<article>` + inner `<button>` for complex cards). For locked cards, use `disabled` or `aria-disabled`.

---

**A-03 — `NumberInput` +/− buttons lack accessible labels**
`src/screens/SettingsScreen.tsx:124,131`

The increment/decrement buttons render the literal characters `−` and `+` with no `aria-label`. A screen reader will announce "minus button" or "plus button" — it won't say what is being incremented.

Fix:
```tsx
<button aria-label={`Decrease ${label}`} onClick={...}>−</button>
<button aria-label={`Increase ${label}`} onClick={...}>+</button>
```

---

### MEDIUM

**A-04 — `animate-spin` spinner has no `prefers-reduced-motion` guard (WCAG 2.3.3)**
`src/screens/LearnScreen.tsx:295`

```tsx
<div className="text-4xl mb-3 animate-spin">⏳</div>
```

Tailwind's `animate-spin` runs a CSS `animation` unconditionally. Users with vestibular disorders who have `prefers-reduced-motion: reduce` set will still see the spinning emoji. Tailwind 3 supports `motion-reduce:animate-none` as a utility class.

Fix:
```tsx
<div className="text-4xl mb-3 animate-spin motion-reduce:animate-none">⏳</div>
```
Consider replacing the spinning emoji with a static "Loading…" text anyway — it carries no semantic meaning to screen readers.

---

**A-05 — `CardItem` inline star button has uninformative `aria-label` ("Unstar" / "Star" without context)**
`src/screens/CardGalleryScreen.tsx:322`

The `aria-label` is just `'Unstar'` or `'Star'` — no word name included. In the detail panel (`CardDetail`, line 180) the label is better: `'Remove from starred words'` / `'Add to starred words'`. The list-item variant should match, or at minimum include the word: `Star ${card.swahili}`.

---

**A-06 — `NounClassExercise` option buttons have no `aria-label` or `aria-pressed` state after selection**
`src/components/exercises/NounClassExercise.tsx:66`

After the learner selects an option, the correct/incorrect state is communicated only through border colour. The `aria-live` pattern used in `TypeAnswer`, `MultipleChoice`, and `FillInBlank` (which do have this) is missing here. No `aria-live` result announcement exists.

Fix: Add the same `aria-live="polite"` result paragraph pattern used in the other exercise components (see `MultipleChoice.tsx:103`).

---

**A-07 — Activity heatmap cells are not announced by screen readers**
`src/screens/StatsScreen.tsx:131–139`

Each `<div title="2026-06-14: 5 reviews">` relies on the native `title` tooltip, which is not reliably announced by screen readers. The grid has no `role`, no `aria-label`, and the colour-only opacity encoding (WCAG 1.4.1) would be invisible to colour-blind users.

Fix: Add `role="img" aria-label="Activity heatmap for the last 12 weeks"` to the grid container. Optionally add an off-screen summary of total reviews per week.

---

**A-08 — FlashCard "Reveal Answer" button does not programmatically announce the revealed content**
`src/components/exercises/FlashCard.tsx:64–70`

Clicking "Reveal Answer" triggers a React re-render that shows the answer, but there is no `aria-live` region to notify screen readers. A keyboard user could press the button and not know the answer appeared without manually navigating to it.

Fix: Wrap the revealed answer `<div>` in an `aria-live="polite"` region, or add a visually-hidden but live-region paragraph that announces the revealed answer.

---

**A-09 — Search input in CardGallery has no `<label>` element (WCAG 1.3.1)**
`src/screens/CardGalleryScreen.tsx:439–445`

The `<input type="text">` for gallery search uses only `placeholder` text. Placeholder is not a substitute for a label — it disappears on input and is not consistently read by screen readers.

Fix:
```tsx
<label htmlFor="gallery-search" className="sr-only">Search Swahili or English</label>
<input id="gallery-search" type="text" ... />
```

---

**A-10 — Range slider for new-word-rate has no accessible value label**
`src/screens/SettingsScreen.tsx:299–303`

The `<input type="range">` has no `aria-label` and no `aria-valuetext`. Screen readers will announce the numeric value (0–100) but not what it means.

Fix:
```tsx
<input
  type="range"
  aria-label="New word rate"
  aria-valuetext={`${settings.new_word_rate}% new words`}
  ...
/>
```

---

**A-11 — InfoNote disclosure button in UnitLessonScreen has no `aria-expanded`**
`src/screens/UnitLessonScreen.tsx:46`

The `<button>` that toggles the grammar explanation uses visual `▲`/`▼` chevrons but has no `aria-expanded` attribute. Screen reader users cannot tell whether the content is currently visible without reading surrounding content.

Fix:
```tsx
<button aria-expanded={open} ...>
```

---

### LOW

**A-12 — Nav emoji icons in Layout are announced as text by some screen readers**
`src/components/Layout.tsx:70`

The icon `<span className="text-xl">{t.icon}</span>` renders as visible emoji but is not hidden from AT. Screen readers may announce "house emoji, Home" or "books emoji, Learn" which is redundant. Adding `aria-hidden="true"` to the icon span removes the double-announcement.

Fix: `<span className="text-xl" aria-hidden="true">{t.icon}</span>`

---

**A-13 — Inline SVG `›` chevron in CardItem not hidden from screen readers**
`src/screens/CardGalleryScreen.tsx:335`

`<span className="text-slate-600 text-lg">›</span>` will be announced by some screen readers as "right-pointing angle bracket" or similar. Use `aria-hidden="true"`.

---

**A-14 — Contrast: `text-slate-600` on `bg-slate-800` fails WCAG AA**

Several secondary labels use `text-slate-600` (`#475569`) on `bg-slate-800` (`#1e293b`). Approximate contrast ratio is ~2.6:1, well below the 4.5:1 required for normal text (WCAG 1.4.3). Instances include:
- `src/screens/CardGalleryScreen.tsx:335` (chevron, though decorative)
- `src/screens/CardGalleryScreen.tsx:40` (`DepthBadge` "new" label)
- `src/screens/UnitMapScreen.tsx:61` ("Unit N" sub-label)
- `src/screens/StatsScreen.tsx:88` ("all curriculum cards not yet started" sub-note)

The existing `high_contrast` setting helps but is opt-in. Use `text-slate-500` (`#64748b`) minimum or `text-slate-400` for critical labels.

---

## Code Quality Issues

### HIGH

**Q-01 — `upsertCardState` silently drops `starred` on conflict (data-loss bug)**
`src/database/db.ts:941–966`

The `ON CONFLICT DO UPDATE SET` clause lists every column _except_ `starred`. This means that every time a card is reviewed (`upsertCardState` is called in `submitRating`), the `starred` column in SQLite is reset to whatever value is in the INSERT row — which is correct in the upsert because `state.starred ? 1 : 0` is passed. However, if `state.starred` in the in-memory pool has gone stale (e.g., the user starred it via `setCardStarred` in one tab while a session was active), the review write will silently overwrite the star. More critically: the `DO UPDATE SET` does not include `starred = excluded.starred`, so the database will _not_ update the starred field from the conflict row — it keeps the old DB value. This is inconsistent: the INSERT will set it, but a conflict will not update it.

Fix: Either add `starred = excluded.starred` to the `DO UPDATE SET` clause, or remove `starred` from the upsert entirely and rely only on `setCardStarred`.

---

**Q-02 — Migration version cannot be incremented: all new migrations must be added to the monolithic `if (version < 1)` block**
`src/database/db.ts:377–767`

The migration system uses a single version gate (`LEGACY_MIGRATION_VERSION = 1`). Any new migration must either be added _inside_ the existing `if (getMigrationVersion < 1)` block (but that block has already run on existing users and won't run again), or requires bumping `LEGACY_MIGRATION_VERSION` to 2 and wrapping new work in `if (version < 2)`. There is no pattern enforcing this — it's easy to add a new `try { _db.run(ALTER TABLE ...) }` at the bottom of `openDatabase` and forget that it bypasses the version check entirely, running on every open.

The monolithic migration block already spans lines 378–767 (390 lines). This is a significant maintainability risk as the codebase grows.

Fix: Introduce a simple sequential migration array pattern:
```ts
const MIGRATIONS: Array<(db: Database) => void> = [
  /* v1 */ (db) => { /* ... existing migrations ... */ },
  /* v2 */ (db) => { /* ... new migrations ... */ },
];
```
Run each one in sequence up to `MIGRATIONS.length`, incrementing the stored version after each step.

---

**Q-03 — FillInBlank correct-answer extraction is fragile (string subtraction)**
`src/components/exercises/FillInBlank.tsx:23–25`

```ts
const correctAnswer = card.example_sentences[0]
  ? card.example_sentences[0].swahili.replace(before, '').replace(after, '').trim()
  : card.verb_root ?? '';
```

This extracts the blank answer by subtracting the `before` and `after` strings from the example sentence. If the example sentence contains the `before` or `after` substring more than once (e.g., a word appears in both `before` and `after`), the extraction will be wrong. `String.replace()` replaces only the _first_ occurrence. Additionally, if `correctAnswer` is empty string (because the example sentence doesn't match), the card will silently accept any input as correct.

Fix: Store the expected fill-blank answer directly in the card data (a `fill_blank_answer` field), or use a regex anchored to the blank position. At minimum add a guard:
```ts
if (!correctAnswer) { /* skip this card or use verb_root as fallback */ }
```

---

### MEDIUM

**Q-04 — `depthWeight` in sessionAssembly has overlapping conditions (dead branch)**
`src/scheduling/sessionAssembly.ts:28–36`

```ts
if (depth < 2)    return 4.0; // new / unseen
if (depth <= 2)   return 5.0; // learning
```

`depth < 2` catches all values below 2 (including `DepthLevel` value `1`). The second condition `depth <= 2` then catches exactly `depth === 2`. But `DepthLevel` is typed as `1 | 2 | 2.5 | 3 | 4 | 4.5 | 5.1 | 5.2 | 5.3` — so the first branch always handles `1` and the second handles exactly `2`. The comment "new / unseen" on the first and "learning" on the second are correct but the conditions are confusing; `depth === 1` vs `depth === 2` would be clearer. Not a bug today because `DepthLevel` is discrete, but it is fragile if the type is extended.

---

**Q-05 — `setTimeout` delays in exercise components block keyboard flow and fight `submitRating` race**
`src/components/exercises/TypeAnswer.tsx:52`, `MultipleChoice.tsx:46`, `NounClassExercise.tsx:37`, `FillInBlank.tsx:38`

All exercise components call `onAnswer(...)` inside a `setTimeout` (800ms–1000ms) to give the learner a moment to see the result. During this delay, the rating buttons also appear (`phase === 'rating'`). A fast keyboard user who presses Enter or a rating key immediately after checking can submit a rating before the exercise's `onAnswer` fires, causing a brief state mismatch. The `autoCorrect` state used in `LearnScreen` for `showSimplified` prop will be `null` during the setTimeout window, so the full 5-button rating (not the 2-button simplified) will be shown immediately, then the correct simplified view appears 800ms later — a visible flash.

This is not a data-integrity bug (the rating submission is protected by `card` existence checks), but it creates a jarring UX for keyboard users.

Fix: Call `onAnswer` synchronously and move the visual delay (if needed) into `LearnScreen`'s phase transition, not the exercise component.

---

**Q-06 — `RegisterBadge` in CardGalleryScreen has redundant null check**
`src/screens/CardGalleryScreen.tsx:28`

```ts
if (!register || register === 'neutral' || !register) return null;
```

`!register` is checked twice. Minor, but shows copy-paste noise.

---

**Q-07 — `openDatabase` migration block has duplicate comment for E-04 (misleading)**
`src/database/db.ts:696–743`

The comment `// E-04: Populate cultural notes for culturally rich vocabulary words` appears at line 696 and again at line 743. The F-01 grammar track migration happens between them (lines 698–741) without its own clearly delineated comment block. The interleaving makes it hard to audit which migration step does what.

---

**Q-08 — `multipleChoice` pool filtering uses `Math.random()` in `useEffect` (SSR-unsafe, re-randomizes on deps change)**
`src/components/exercises/MultipleChoice.tsx:21`

```ts
const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
```

`Array.sort` with a random comparator is not a uniform shuffle (it's biased). Use Fisher-Yates for correctness. Also, the `useEffect` re-runs on `[card.id, easy, direction]` changes, which means if any of those deps changes after a card is shown (which doesn't happen today but would if direction randomization ever triggers), the options reshuffle mid-display.

---

**Q-09 — `CardGalleryScreen` search fires on every keystroke with no debounce**
`src/screens/CardGalleryScreen.tsx:403–408`

`runSearch` is called via `useEffect([runSearch])`, and `runSearch` itself is a `useCallback` that recreates on every `search` state change. Since `search` updates on every keystroke (`onChange={e => setSearch(e.target.value)}`), and each call to `runSearch` hits the SQLite database synchronously, rapid typing triggers many sequential DB reads. For small datasets this is fine, but it will become slow as the card count grows.

Fix: Add a 200–300ms debounce to `setSearch` updates or to the `runSearch` call.

---

**Q-10 — `LearnScreen` has two `mode`-like states that can diverge: `mode` vs `activeMode`**
`src/screens/LearnScreen.tsx:98–99`

`mode` tracks the user's selection; `activeMode` is set at session start to remember what mode the _active session_ is using. This is correct in intent but creates risk: if code ever reads `mode` where it should read `activeMode` (e.g., in the empty-state check at line 303), the wrong mode is used. Currently `activeMode` is only used in one place (line 303). The distinction could be eliminated by tracking a single `sessionMode` that is set on start.

---

**Q-11 — `FillInBlank` input appears below the inline text display rather than replacing it**
`src/components/exercises/FillInBlank.tsx:41–75`

The visible sentence with a blank (`before [___] after`) is rendered in one `<div>`, and the `<input>` appears below it separately. The learner must mentally associate their typing with the blank above. After submission the blank shows the typed answer, but the `<input>` stays visible (disabled). This creates two representations of the answer simultaneously.

A cleaner pattern (used by tools like Duolingo) is to focus the input _inside_ the sentence at the blank position. This is a UX issue rather than a bug, and is noted here as a maintainability observation since the current architecture makes it hard to change.

---

**Q-12 — `db.ts` is 1757 lines; single responsibility principle violated**
`src/database/db.ts`

The file contains: WASM initialisation, IndexedDB helpers, migration runner, content transformation utilities (400+ lines of English grammar transformation helpers), all schema queries, and helper functions. This makes it very hard to navigate and test. The content transformation helpers (`_ciTransform`, `_fixPluralEnglish`, `_pluralizeBase`, etc.) are only ever called from within the migration block and could be extracted to a separate file.

---

### LOW

**Q-13 — `scaffoldLevel` comment says "depth ≤ 3" clamps to `multiple_choice` but the clamp applies to level, not exercise**
`src/algorithms/afm.ts:22–27`

The comment says the clamp prevents "a harder exercise than the card has earned individually", but the clamp sets `level` to `3`, which maps to `multiple_choice` in `pickExercise`. For depth 2 (learning), this is correct; for depth 3 (young/known), this is arguably over-conservative — a card at depth 3 has been reviewed multiple times. The PLAN.md item D-1 (type-answer exercises appearing too rarely) may partly trace to this clamp.

---

**Q-14 — `getProfile` mutates settings and writes back on every open if any default is missing**
`src/database/db.ts:858–874`

If a new settings key is added to `SETTING_DEFAULTS`, the first `getProfile()` call after migration will detect it missing, set `dirty = true`, and write back. This is correct behaviour, but it means adding a new default to `SETTING_DEFAULTS` is effectively a data migration disguised as runtime code. There is no versioning or log of when defaults were applied.

---

**Q-15 — `CardDetail` modal uses `fixed inset-0` with no `role="dialog"` or focus trap**
`src/screens/CardGalleryScreen.tsx:177`

The card detail overlay renders as `<div className="fixed inset-0 ...">` with no `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby`, and no focus trap. Screen reader users will not know a modal has opened, and keyboard focus can escape into the background content behind the overlay.

---

## PLAN.md Status Check

| Item | Status | Notes |
|------|--------|-------|
| **A-1** Color-only feedback | **DONE** | All four exercise components now have `aria-live="polite"` `✓ Correct` / `✗ Incorrect` text badges alongside the border. (`TypeAnswer:75`, `MultipleChoice:103`, `FillInBlank:56`) |
| **A-2** Star button accessible name | **DONE** | `CardDetail` (`CardGalleryScreen:180`) has `aria-label={starred ? 'Remove from starred words' : 'Add to starred words'}`. `LearnScreen:397` also has `aria-label`. `CardItem` (line 322) still uses abbreviated `'Unstar'`/`'Star'` (see A-05 above). |
| **A-3** Keyboard tab order / autofocus | **PARTIALLY DONE** | `TypeAnswer` and `FillInBlank` both call `inputRef.current?.focus()` on card change. `RecallPrompt` and `FlashCard` do not autofocus any control, so keyboard users must Tab to reach the first button after each card advance. |
| **B-1** Layout DB retry | **DONE** | `Layout.tsx:29–30` has `.catch(() => openDatabase(stored))` retry pattern. |
| **B-2** Developer Tools hidden in production | **DONE** | `SettingsScreen.tsx:423` wraps developer tools in `{import.meta.env.DEV && ...}`. |
| **C-1** "Not yet seen" label for depth-1 cards | **DONE** | `StatsScreen.tsx:7` uses `'Not yet seen'` and adds a clarifying sub-note at line 87. |
| **C-2** Daily goal progress on Home screen | **DONE** | `HomeScreen.tsx:70–83` renders a daily reviews progress bar with `dailyStats` and `profile.settings.reviews_per_day`. |
| **C-3** Date labels on activity heatmap | **DONE** | `StatsScreen.tsx:122–127` shows month abbreviation column headers when a week crosses a month boundary. |
| **D-1** Investigate type-answer-only sessions | **OPEN** | No console logging or debug indicator has been added. The `afm.ts` clamp at line 25 (`if (depth <= 3 && level < 3) level = 3`) caps `type_answer` to cards at depth ≥ 4, which explains why most established learners see `multiple_choice` not `type_answer`. This may be the root cause. No investigation artefact exists in code. |
| **D-2** Show correct answer example more prominently on wrong answers | **DONE** | All exercise components show `"Remember it with:"` block on wrong answers (`TypeAnswer:113–120`, `MultipleChoice:109–114`, `FillInBlank:82–89`). |
| **D-3** Syllable breakdown on first-exposure RecallPrompt | **PARTIALLY DONE** | `RecallPrompt.tsx:29` shows `card.pronunciation` (which is the syllabified form) on the card face before reveal. IPA style is not separately handled. |
| **E-1/E-2/E-3** Audio TTS SpeakButton | **OPEN** | No `SpeakButton` component found; no audio in exercises or settings. |
| **F-1** Orange border on Home screen | **OPEN** | No fix applied; not reproducible in source — likely was a browser extension or OS-level focus ring. |
| **F-2** Nav icon emoji consistency | **OPEN** | Still using emoji in `Layout.tsx`. Low priority per plan. |

---

## Top Recommendations

1. **Fix the `upsertCardState` starred column omission** (Q-01) — it is a latent data-loss bug where star state could be silently overwritten during reviews. One line fix: add `starred = excluded.starred` to the `DO UPDATE SET` clause.

2. **Add ARIA switch semantics to `ToggleRow`** (A-01) — affects 8 settings controls; adding `role="switch" aria-checked={value} aria-label={label}` is a 3-line fix with large accessibility impact.

3. **Replace `div onClick` with `button` in UnitMapScreen and CardGalleryScreen** (A-02) — fixes keyboard navigation to unit cards and gallery items, which are currently mouse-only.

4. **Add `prefers-reduced-motion` guard to `animate-spin`** (A-04) — single Tailwind class addition: `motion-reduce:animate-none`.

5. **Add `aria-label` to the gallery search input** (A-09) — one `<label htmlFor>` addition; the placeholder alone is not accessible.

6. **Plan for migration version increment** (Q-02) — before the next schema change, establish a numbered migration array so future changes don't require auditing the entire 390-line migration block.

7. **Add a `role="dialog"` focus trap to `CardDetail`** (Q-15) — the full-screen overlay currently lets keyboard/screen reader focus escape into the background list.
