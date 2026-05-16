# Swahili Learning App

A progressive web app for learning Swahili, built with React and TypeScript. Uses spaced repetition (FSRS) and adaptive scaffolding to help you move from zero to conversational Swahili through structured units and open-ended practice sessions.

Runs entirely in the browser — no server, no account required. User data is stored locally in the browser's IndexedDB.

---

## Features

- **Structured units** — Curriculum organised into beginner, intermediate, and advanced units, each broken into lessons. Units unlock as prerequisites are completed.
- **Lesson flow** — Grammar notes → word introduction → multiple-choice practice. A lesson only completes when you get every question right.
- **Spaced repetition practice** — Open-ended sessions that draw cards by weight: shallower cards and cards approaching their review date are more likely to appear. End whenever you like.
- **Adaptive exercises** — Flashcards (random Swahili↔English direction), multiple choice, type-answer, and fill-in-the-blank. Exercise type is chosen based on your per-skill mastery.
- **Offline-first PWA** — Install from the browser; works with no internet connection after the first load.
- **Multi-user** — Multiple profiles on the same device, each with their own isolated database.

---

## Tech Stack

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript |
| Routing | React Router 6 |
| Styling | Tailwind CSS |
| State | Zustand |
| Database | sql.js (SQLite over WebAssembly) + IndexedDB |
| SRS algorithm | FSRS |
| Build | Vite 5 |
| PWA | vite-plugin-pwa (Workbox) |
| Hosting | Vercel |

---

## Project Structure

```
web/
├── public/
│   ├── swahili_default.db   # Template SQLite DB (cards, units, initial states)
│   └── sql-wasm.wasm        # SQLite WebAssembly binary
├── src/
│   ├── algorithms/
│   │   ├── fsrs.ts          # FSRS spaced repetition scheduler
│   │   ├── afm.ts           # Adaptive scaffolding (exercise level + hints)
│   │   └── errorClassifier.ts
│   ├── components/
│   │   └── exercises/       # FlashCard, MultipleChoice, TypeAnswer, FillInBlank, RecallPrompt
│   ├── database/
│   │   └── db.ts            # All DB queries; opens/migrates per-user SQLite DB
│   ├── scheduling/
│   │   └── sessionAssembly.ts  # Weighted card draw for practice sessions
│   ├── screens/
│   │   ├── UserPickerScreen.tsx
│   │   ├── OnboardingScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── LearnScreen.tsx
│   │   ├── UnitMapScreen.tsx
│   │   ├── UnitDetailScreen.tsx
│   │   ├── UnitLessonScreen.tsx
│   │   ├── StatsScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── store/
│   │   └── sessionStore.ts  # Zustand store for active practice session
│   ├── types.ts
│   └── utils/
│       └── lessons.ts       # Splits unit cards into lessons
├── vite.config.ts
└── vercel.json
```

---

## Database Schema

Each user gets their own copy of `swahili_default.db` stored in IndexedDB. The schema contains:

- **cards** — Swahili/English pairs with pronunciation, tags, noun class, verb root, example sentences, and frequency rank
- **card_states** — Per-card FSRS state: depth level (1–5.3), stability, difficulty, retrievability, review count, next review date
- **units / unit_progress** — Curriculum structure and per-user completion status
- **sessions / review_logs** — Full history of study sessions and individual card reviews
- **skill_mastery** — Aggregate correct/opportunity counts per skill tag, used for adaptive scaffolding
- **error_patterns** — Phonological, semantic, and structural error counts per skill tag

---

## Running Locally

```bash
cd web
npm install
npm run dev
```

The app is served at `http://localhost:5173`. It must be served over HTTP (not opened as a file) because WebAssembly and IndexedDB require an HTTP origin.

### Updating the word database

The template DB lives in the sibling `SwahiliApp/data/` directory. To copy it into the web app's public folder after making changes:

```bash
npm run copy-db
```

---

## Deployment

The app is deployed on Vercel as a static site with PWA support.

### Deploy to Vercel

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. Set the following in project settings:
   - **Root directory**: `web`
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
4. Deploy

`vercel.json` handles SPA routing (all paths → `index.html`) and sets the correct `Content-Type` for `.wasm` files.

### Installing as an app (PWA)

After visiting the deployed URL in Chrome or Edge, an install prompt appears in the address bar. Clicking it adds the app to the desktop or taskbar. It then works offline.

> **Note:** The icons (`icon-192.svg`, `icon-512.svg`) are placeholder SVGs. Replace them with proper 192×192 and 512×512 PNGs for full iOS Safari support.

---

## How the SRS Works

Cards move through depth levels as you review them:

| Depth | Label | Typical interval |
|---|---|---|
| 1 | New | Not yet introduced |
| 2 | Learning | Minutes to days |
| 3 | Young | ~7–14 days |
| 4 | Established | ~21–90 days |
| 5.1–5.3 | Long-term | 3 months–1 year+ |

New words are introduced through unit lessons (not the practice session). Once introduced (depth ≥ 2), cards appear in the practice session weighted by depth and time: shallower cards and cards closer to their review date are drawn more often. Ratings 1–5 feed into FSRS to compute the next interval.
