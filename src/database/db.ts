/**
 * Web database layer — sql.js (WebAssembly SQLite) + IndexedDB persistence.
 *
 * Strategy:
 *   - Template DB (all cards, initial card_states) is bundled at /swahili_default.db
 *   - Each user gets their own copy in IndexedDB keyed by username
 *   - On open: load from IndexedDB; if absent, fetch template and copy it
 *   - After every write: flush to IndexedDB (debounced)
 */

import type { Database, SqlJsStatic } from 'sql.js';
import type {
  Card, CardState, CardWithState, Profile, ProfileSettings,
  Session, ReviewLog, Unit, UnitProgress, ErrorType,
} from '../types';

const DEFAULT_NEW_WORDS_PER_DAY = 10;
const DEFAULT_REVIEWS_PER_DAY = 20;

// ─── sql.js init ──────────────────────────────────────────────────────────────

let SQL: SqlJsStatic | null = null;

async function getSql(): Promise<SqlJsStatic> {
  if (!SQL) {
    const { default: initSqlJs } = await import('sql.js');
    SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  }
  return SQL;
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

const IDB_NAME = 'swahili_app';
const IDB_STORE = 'databases';
const IDB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbLoad(key: string): Promise<Uint8Array | null> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSave(key: string, data: Uint8Array): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(data, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Singleton connection ──────────────────────────────────────────────────────

let _db: Database | null = null;
let _currentUser: string | null = null;
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(flushToDisk, 500);
}

async function flushToDisk() {
  if (!_db || !_currentUser) return;
  const data = _db.export();
  await idbSave(`db_${_currentUser}`, data);
}

export function getDb(): Database {
  if (!_db) throw new Error('No database open. Call openDatabase first.');
  return _db;
}

export function getCurrentUser(): string | null {
  return _currentUser;
}

export async function listUsers(): Promise<string[]> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAllKeys();
    req.onsuccess = () => {
      const keys = (req.result as string[]).filter(k => k.startsWith('db_'));
      resolve(keys.map(k => k.replace(/^db_/, '')));
    };
    req.onerror = () => reject(req.error);
  });
}

// Saves a downloaded DB binary into IndexedDB before openDatabase is called.
export async function importDatabase(userName: string, data: Uint8Array): Promise<void> {
  await idbSave(`db_${userName}`, data);
}

export async function openDatabase(userName: string): Promise<void> {
  if (_db && _currentUser === userName) return;
  if (_db) {
    await flushToDisk();
    _db.close();
    _db = null;
  }

  const sql = await getSql();
  const key = `db_${userName}`;
  let existing = await idbLoad(key);

  if (!existing) {
    // First time for this user — clone the template DB
    const resp = await fetch('/swahili_default.db');
    if (!resp.ok) throw new Error('Failed to load template database');
    existing = new Uint8Array(await resp.arrayBuffer());
    await idbSave(key, existing);
  }

  _db = new sql.Database(existing);
  _currentUser = userName;

  // Idempotent migrations — create/alter tables added after the template DB was generated
  _db.run(`
    CREATE TABLE IF NOT EXISTS skill_mastery (
      skill_tag     TEXT PRIMARY KEY,
      opportunities INTEGER NOT NULL DEFAULT 0,
      correct       INTEGER NOT NULL DEFAULT 0,
      updated_at    TEXT NOT NULL
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS error_patterns (
      skill_tag  TEXT NOT NULL,
      error_type TEXT NOT NULL,
      count      INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (skill_tag, error_type)
    )
  `);
  // ALTER TABLE doesn't support IF NOT EXISTS — use try/catch
  try { _db.run('ALTER TABLE review_logs ADD COLUMN error_type TEXT'); } catch { /* already exists */ }
  // Fix cards introduced with review_count=1 but stability=0 — treat them as new on next review
  _db.run(`UPDATE card_states SET review_count = 0 WHERE stability = 0 AND depth_level >= 2`);
  // Promote any in_progress unit to completed if all its cards have been introduced (depth >= 2)
  _db.run(`
    UPDATE unit_progress SET status = 'completed', completed_at = COALESCE(completed_at, datetime('now'))
    WHERE status = 'in_progress'
      AND unit_id IN (
        SELECT c.unit_id FROM cards c
        JOIN card_states cs ON cs.card_id = c.id
        GROUP BY c.unit_id
        HAVING COUNT(*) = SUM(CASE WHEN cs.depth_level >= 2 THEN 1 ELSE 0 END)
      )
  `);
}

export async function closeDatabase(): Promise<void> {
  await flushToDisk();
  _db?.close();
  _db = null;
  _currentUser = null;
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

type Param = string | number | null | undefined;

function run(sql: string, params: Param[] = []): void {
  const db = getDb();
  db.run(sql, params.map(p => p === undefined ? null : p));
  scheduleFlush();
}

function query<T = Record<string, unknown>>(sql: string, params: Param[] = []): T[] {
  const db = getDb();
  const result = db.exec(sql, params.map(p => p === undefined ? null : p));
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj as T;
  });
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile | null> {
  const rows = query<Record<string, unknown>>('SELECT * FROM profile LIMIT 1');
  if (!rows.length) return null;
  const row = rows[0];
  let settings: ProfileSettings = JSON.parse(row.settings as string);
  // Migrate old settings shape → new shape
  let dirty = false;
  if (!('new_words_per_day' in settings)) {
    (settings as Partial<ProfileSettings>).new_words_per_day = DEFAULT_NEW_WORDS_PER_DAY;
    dirty = true;
  }
  if (!('reviews_per_day' in settings)) {
    (settings as Partial<ProfileSettings>).reviews_per_day = DEFAULT_REVIEWS_PER_DAY;
    dirty = true;
  }
  if (dirty) run('UPDATE profile SET settings = ?', [JSON.stringify(settings)]);
  return {
    display_name: row.display_name as string,
    created_at: row.created_at as string,
    settings,
    last_activity: row.last_activity as string | null,
  };
}

export async function createProfile(displayName: string, settings: ProfileSettings): Promise<void> {
  run(
    `INSERT INTO profile (display_name, created_at, settings, streak_current, streak_longest, last_activity, total_xp)
     VALUES (?, ?, ?, 0, 0, NULL, 0)`,
    [displayName, new Date().toISOString(), JSON.stringify(settings)],
  );
}

export async function updateProfileSettings(settings: ProfileSettings): Promise<void> {
  run('UPDATE profile SET settings = ?', [JSON.stringify(settings)]);
}

export async function recordActivity(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  run('UPDATE profile SET last_activity = ?', [today]);
}

// ─── Units ────────────────────────────────────────────────────────────────────

export async function getUnits(): Promise<Unit[]> {
  return query<Record<string, unknown>>('SELECT * FROM units ORDER BY order_index')
    .map(r => ({ ...r, prerequisite_ids: JSON.parse(r.prerequisite_ids as string) }) as unknown as Unit);
}

// ─── Unit Progress ────────────────────────────────────────────────────────────

export async function getAllUnitProgress(): Promise<UnitProgress[]> {
  return query<UnitProgress>('SELECT * FROM unit_progress');
}

export async function upsertUnitProgress(progress: UnitProgress): Promise<void> {
  run(
    `INSERT INTO unit_progress (unit_id, status, started_at, completed_at, mastery_score)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(unit_id) DO UPDATE SET
       status = excluded.status,
       started_at = COALESCE(unit_progress.started_at, excluded.started_at),
       completed_at = excluded.completed_at,
       mastery_score = excluded.mastery_score`,
    [progress.unit_id, progress.status, progress.started_at, progress.completed_at, progress.mastery_score],
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function parseCard(row: Record<string, unknown>): Card {
  return {
    ...row,
    tags: JSON.parse(row.tags as string),
    quick_learn: (row.quick_learn as number) === 1,
    example_sentences: JSON.parse(row.example_sentences as string),
  } as unknown as Card;
}

// ─── Card States ──────────────────────────────────────────────────────────────

export async function upsertCardState(state: CardState): Promise<void> {
  run(
    `INSERT INTO card_states
       (card_id, depth_level, stability, difficulty, retrievability,
        last_review, next_review, review_count, lapse_count,
        consecutive_correct, fast_learn_level, fast_learn_fail_count)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(card_id) DO UPDATE SET
       depth_level = excluded.depth_level, stability = excluded.stability,
       difficulty = excluded.difficulty, retrievability = excluded.retrievability,
       last_review = excluded.last_review, next_review = excluded.next_review,
       review_count = excluded.review_count, lapse_count = excluded.lapse_count,
       consecutive_correct = excluded.consecutive_correct,
       fast_learn_level = excluded.fast_learn_level,
       fast_learn_fail_count = excluded.fast_learn_fail_count`,
    [
      state.card_id, state.depth_level, state.stability, state.difficulty,
      state.retrievability, state.last_review, state.next_review,
      state.review_count, state.lapse_count, state.consecutive_correct,
      state.fast_learn_level, state.fast_learn_fail_count,
    ],
  );
}

// ─── Session query helpers ────────────────────────────────────────────────────

function buildCardWithState(row: Record<string, unknown>): CardWithState {
  const state: CardState = {
    card_id: row.card_id as string,
    depth_level: row.depth_level as CardState['depth_level'],
    stability: row.stability as number,
    difficulty: row.difficulty as number,
    retrievability: row.retrievability as number,
    last_review: row.last_review as string | null,
    next_review: row.next_review as string | null,
    review_count: row.review_count as number,
    lapse_count: row.lapse_count as number,
    consecutive_correct: row.consecutive_correct as number,
    fast_learn_level: row.fast_learn_level as 0 | 2 | 4,
    fast_learn_fail_count: row.fast_learn_fail_count as number,
  };
  return {
    id: row.id as string,
    swahili: row.swahili as string,
    english: row.english as string,
    pronunciation: row.pronunciation as string,
    type: row.type as Card['type'],
    tags: JSON.parse(row.tags as string),
    noun_class: row.noun_class as string | undefined,
    verb_root: row.verb_root as string | undefined,
    conjugation_key: row.conjugation_key as string | undefined,
    base_difficulty: row.base_difficulty as number,
    frequency_rank: row.frequency_rank as number,
    quick_learn: (row.quick_learn as number) === 1,
    unit_id: row.unit_id as string,
    source: row.source as Card['source'],
    prerequisite_card_id: row.prerequisite_card_id as string | undefined,
    example_sentences: JSON.parse(row.example_sentences as string),
    state,
  };
}

export async function getDueCards(nowIso: string): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.next_review <= ? AND cs.depth_level >= 2
     ORDER BY cs.next_review ASC`,
    [nowIso],
  ).map(buildCardWithState);
}

export async function getNewCards(limit: number): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.depth_level = 1
       AND (c.prerequisite_card_id IS NULL
            OR EXISTS (
              SELECT 1 FROM card_states ps
              WHERE ps.card_id = c.prerequisite_card_id AND ps.depth_level >= 3
            ))
     ORDER BY c.frequency_rank ASC
     LIMIT ?`,
    [limit],
  ).map(buildCardWithState);
}

export async function getMatureCards(): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.depth_level IN (2.5, 4, 4.5, 5.1, 5.2, 5.3)`,
  ).map(buildCardWithState);
}

export async function getIntroducedCards(): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.depth_level >= 2
     ORDER BY cs.next_review ASC`,
  ).map(buildCardWithState);
}

export async function countCardsByDepth(): Promise<Record<number, number>> {
  const rows = query<{ depth_level: number; cnt: number }>(
    'SELECT depth_level, COUNT(*) as cnt FROM card_states GROUP BY depth_level',
  );
  const counts: Record<number, number> = {};
  for (const row of rows) counts[row.depth_level] = row.cnt;
  return counts;
}

export async function countOverdueCards(nowIso: string): Promise<number> {
  const rows = query<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM card_states WHERE next_review <= ? AND depth_level >= 2',
    [nowIso],
  );
  return rows[0]?.cnt ?? 0;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getLastSession(): Promise<Session | null> {
  const rows = query<Session>('SELECT * FROM sessions ORDER BY completed_at DESC LIMIT 1');
  return rows[0] ?? null;
}

export async function insertSession(session: Session): Promise<void> {
  run(
    `INSERT INTO sessions
       (id, completed_at, cards_reviewed, new_words_introduced, recall_rate, again_count, new_words_tomorrow)
     VALUES (?,?,?,?,?,?,?)`,
    [session.id, session.completed_at, session.cards_reviewed, session.new_words_introduced,
     session.recall_rate, session.again_count, session.new_words_tomorrow],
  );
}

// ─── Review Logs ──────────────────────────────────────────────────────────────

export async function insertReviewLog(log: ReviewLog): Promise<void> {
  run(
    `INSERT INTO review_logs
       (id, card_id, session_id, reviewed_at, rating, response_ms, exercise_type, error_type,
        prev_stability, prev_difficulty, new_stability, new_difficulty, scheduled_days, actual_days)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [log.id, log.card_id, log.session_id, log.reviewed_at, log.rating, log.response_ms,
     log.exercise_type, log.error_type,
     log.prev_stability, log.prev_difficulty, log.new_stability,
     log.new_difficulty, log.scheduled_days, log.actual_days],
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getRetentionByCategory(): Promise<Array<{ category: string; retention: number }>> {
  return query(
    `SELECT c.type as category,
       ROUND(100.0 * SUM(CASE WHEN rl.rating >= 3 THEN 1 ELSE 0 END) / COUNT(*), 1) as retention
     FROM review_logs rl
     JOIN cards c ON c.id = rl.card_id
     GROUP BY c.type`,
  ) as Array<{ category: string; retention: number }>;
}

export async function getDailyActivity(days = 84): Promise<Array<{ date: string; count: number }>> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return query(
    `SELECT substr(reviewed_at, 1, 10) as date, COUNT(*) as count
     FROM review_logs WHERE reviewed_at >= ? GROUP BY date ORDER BY date`,
    [since],
  ) as Array<{ date: string; count: number }>;
}

export async function getTotalReviews(): Promise<number> {
  const rows = query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM review_logs');
  return rows[0]?.cnt ?? 0;
}

export async function getUnitMasteryStats(): Promise<Map<string, { total: number; introduced: number; retained: number }>> {
  const rows = query<{ unit_id: string; total: number; introduced: number; retained: number }>(
    `SELECT c.unit_id,
       COUNT(*) as total,
       SUM(CASE WHEN cs.depth_level >= 2 THEN 1 ELSE 0 END) as introduced,
       SUM(CASE WHEN cs.depth_level >= 3 THEN 1 ELSE 0 END) as retained
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     GROUP BY c.unit_id`,
  );
  const map = new Map<string, { total: number; introduced: number; retained: number }>();
  for (const row of rows) map.set(row.unit_id, { total: row.total, introduced: row.introduced, retained: row.retained });
  return map;
}

export async function getDailyStats(): Promise<{ reviewsToday: number; newWordsToday: number }> {
  const todayStart = new Date().toISOString().slice(0, 10);
  const rRows = query<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM review_logs WHERE reviewed_at >= ?',
    [todayStart],
  );
  const nRows = query<{ cnt: number }>(
    `SELECT COALESCE(SUM(new_words_introduced), 0) as cnt FROM sessions WHERE completed_at >= ?`,
    [todayStart],
  );
  return {
    reviewsToday: rRows[0]?.cnt ?? 0,
    newWordsToday: nRows[0]?.cnt ?? 0,
  };
}

// Cards actively being learned (depth 1–3) — for Revise mode
export async function getLearningCards(): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.depth_level IN (1, 2, 2.5, 3)
     ORDER BY cs.depth_level DESC, c.frequency_rank ASC`,
  ).map(buildCardWithState);
}

// ─── Skill Mastery (AFM) ──────────────────────────────────────────────────────

// Tags that describe card structure rather than content skill — excluded from mastery tracking
const STRUCTURAL_TAGS = new Set([
  'conjugation', 'infinitive', 'production', 'plural',
  'fill-blank', 'adjective-agreement', 'noun-class', 'object-infix',
  'relative-pronouns', 'demonstratives', 'verbal-noun',
]);

export async function updateSkillMastery(tags: string[], wasCorrect: boolean): Promise<void> {
  const now = new Date().toISOString();
  const correctVal = wasCorrect ? 1 : 0;
  for (const tag of tags) {
    if (STRUCTURAL_TAGS.has(tag)) continue;
    run(
      `INSERT INTO skill_mastery (skill_tag, opportunities, correct, updated_at)
       VALUES (?, 1, ?, ?)
       ON CONFLICT(skill_tag) DO UPDATE SET
         opportunities = skill_mastery.opportunities + 1,
         correct       = skill_mastery.correct + excluded.correct,
         updated_at    = excluded.updated_at`,
      [tag, correctVal, now],
    );
  }
}

export async function getSkillMastery(): Promise<Map<string, number>> {
  const rows = query<{ skill_tag: string; opportunities: number; correct: number }>(
    'SELECT skill_tag, opportunities, correct FROM skill_mastery',
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.skill_tag, row.opportunities > 0 ? row.correct / row.opportunities : 0);
  }
  return map;
}

// ─── Error Patterns ───────────────────────────────────────────────────────────

export async function updateErrorPattern(tags: string[], errorType: ErrorType): Promise<void> {
  const now = new Date().toISOString();
  for (const tag of tags) {
    if (STRUCTURAL_TAGS.has(tag)) continue;
    run(
      `INSERT INTO error_patterns (skill_tag, error_type, count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(skill_tag, error_type) DO UPDATE SET
         count      = error_patterns.count + 1,
         updated_at = excluded.updated_at`,
      [tag, errorType, now],
    );
  }
}

// Returns: skill_tag → { phonological, semantic, structural, total }
export async function getErrorPatterns(): Promise<Map<string, Record<ErrorType | 'total', number>>> {
  const rows = query<{ skill_tag: string; error_type: ErrorType; count: number }>(
    'SELECT skill_tag, error_type, count FROM error_patterns',
  );
  const map = new Map<string, Record<ErrorType | 'total', number>>();
  for (const row of rows) {
    if (!map.has(row.skill_tag)) {
      map.set(row.skill_tag, { phonological: 0, semantic: 0, structural: 0, total: 0 });
    }
    const entry = map.get(row.skill_tag)!;
    entry[row.error_type] = row.count;
    entry.total += row.count;
  }
  return map;
}

// All cards for a unit regardless of state — for Test Out mode
// Bump a specific set of never-reviewed cards to depth 2 so they enter the SRS.
export async function introduceCards(cardIds: string[]): Promise<void> {
  if (!cardIds.length) return;
  const nextReview = new Date(Date.now() + 60 * 60000).toISOString(); // due in 1 hour
  const now = new Date().toISOString();
  for (const id of cardIds) {
    run(
      `UPDATE card_states
       SET depth_level = 2, next_review = ?, last_review = ?
       WHERE card_id = ? AND depth_level = 1`,
      [nextReview, now, id],
    );
  }
}

export async function getUnitCardsWithState(unitId: string): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE c.unit_id = ?
     ORDER BY cs.depth_level ASC, c.frequency_rank ASC`,
    [unitId],
  ).map(buildCardWithState);
}
