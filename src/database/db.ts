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
import { runMigrations } from './migrations';
import { getLanguage, DEFAULT_LANGUAGE } from '../data/languages';
import type {
  Card, CardState, CardWithState, Profile, ProfileSettings,
  Session, ReviewLog, Unit, UnitProgress, ErrorType, MorphemeMastery,
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

async function idbDelete(key: string): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Singleton connection ──────────────────────────────────────────────────────

let _db: Database | null = null;
let _currentUser: string | null = null;
let _currentLanguage: string = DEFAULT_LANGUAGE;
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

export function getCurrentLanguage(): string {
  return _currentLanguage;
}

// IndexedDB key for a user's DB. Swahili keeps the legacy un-prefixed key for
// back-compat with existing users; other languages get a `db_<lang>_<user>` key
// so each language is an independent profile/progress store.
function dbKey(lang: string, user: string): string {
  return lang === DEFAULT_LANGUAGE ? `db_${user}` : `db_${lang}_${user}`;
}

function scheduleFlush() {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(flushToDisk, 500);
}

async function flushToDisk() {
  if (!_db || !_currentUser) return;
  const data = _db.export();
  await idbSave(dbKey(_currentLanguage, _currentUser), data);
}

export function getDb(): Database {
  if (!_db) throw new Error('No database open. Call openDatabase first.');
  return _db;
}

// Call this early (e.g. on the login screen) to pre-load the WASM module so
// the first openDatabase() call doesn't cold-start under user interaction.
export async function warmDatabase(): Promise<void> {
  await getSql();
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

export async function openDatabase(userName: string, lang: string = _currentLanguage): Promise<void> {
  if (_db && _currentUser === userName && _currentLanguage === lang) return;
  if (_db) {
    await flushToDisk();
    _db.close();
    _db = null;
  }

  _currentLanguage = lang;
  const sql = await getSql();
  const key = dbKey(lang, userName);
  let existing = await idbLoad(key);

  if (!existing) {
    // First time for this user+language — clone the language's template DB
    const resp = await fetch(getLanguage(lang).templateDb);
    if (!resp.ok) throw new Error('Failed to load template database');
    existing = new Uint8Array(await resp.arrayBuffer());
    await idbSave(key, existing);
  }

  _db = new sql.Database(existing);
  _currentUser = userName;

  // Migrations are tagged by language; Swahili-specific ones never run on other DBs.
  runMigrations(_db, lang);
  ensureCurriculumInstallMetadata(lang);

  scheduleFlush();
}

export async function closeDatabase(): Promise<void> {
  await flushDatabase();
  _db?.close();
  _db = null;
  _currentUser = null;
}

export async function flushDatabase(): Promise<void> {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  await flushToDisk();
}

// Permanently deletes the current user's database from IndexedDB.
// Call clearGoogleSession() + clearSyncState() + navigate('/') after this.
export async function resetCurrentUserData(): Promise<void> {
  const user = _currentUser;
  const lang = _currentLanguage;
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  _db?.close();
  _db = null;
  _currentUser = null;
  if (user) await idbDelete(dbKey(lang, user));
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

// Shared column list for card_states — used in every JOIN query
const CARD_COLS = `cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
        cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
        cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count,
        cs.response_time_avg_ms, cs.starred`;

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile | null> {
  const rows = query<Record<string, unknown>>('SELECT * FROM profile LIMIT 1');
  if (!rows.length) return null;
  const row = rows[0];
  let settings: ProfileSettings = JSON.parse(row.settings as string);
  let dirty = false;
  const SETTING_DEFAULTS: Partial<ProfileSettings> = {
    new_words_per_day: DEFAULT_NEW_WORDS_PER_DAY,
    reviews_per_day: DEFAULT_REVIEWS_PER_DAY,
    new_word_rate: 20,
    show_example_sentences: true,
    gamification_enabled: true,
    grammar_depth: 'fluency',
    exercise_direction: 'balanced',
    pronunciation_style: 'syllable',
  };
  for (const [k, v] of Object.entries(SETTING_DEFAULTS)) {
    if (!(k in settings)) { (settings as unknown as Record<string, unknown>)[k] = v; dirty = true; }
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

export interface CurriculumPackageInstall {
  language: string;
  package_version: number;
  template_db: string;
  installed_scope: 'all' | 'partial';
  installed_at: string;
  updated_at: string;
}

export interface CurriculumUnitInstall {
  language: string;
  unit_id: string;
  unit_version: number;
  installed_at: string;
}

export async function getCurriculumPackageInstall(): Promise<CurriculumPackageInstall | null> {
  const rows = query<CurriculumPackageInstall>(
    'SELECT * FROM curriculum_packages WHERE language = ? LIMIT 1',
    [_currentLanguage],
  );
  return rows[0] ?? null;
}

export async function getInstalledCurriculumUnits(): Promise<CurriculumUnitInstall[]> {
  return query<CurriculumUnitInstall>(
    `SELECT * FROM curriculum_unit_versions
     WHERE language = ?
     ORDER BY unit_id ASC`,
    [_currentLanguage],
  );
}

export interface LocalProgressChanges {
  exported_at: string;
  language: string;
  since: string | null;
  card_states: CardState[];
  review_logs: ReviewLog[];
  sessions: Session[];
  unit_progress: UnitProgress[];
  review_notes: ReviewNote[];
}

export async function exportLocalProgressChanges(sinceIso?: string | null): Promise<LocalProgressChanges> {
  const since = sinceIso || null;
  const cardWhere = since
    ? 'WHERE last_review >= ? OR COALESCE(starred,0)=1'
    : 'WHERE review_count > 0 OR COALESCE(starred,0)=1';
  const eventWhere = since ? 'WHERE reviewed_at >= ?' : '';
  const sessionWhere = since ? 'WHERE completed_at >= ?' : '';
  const noteWhere = since ? 'WHERE created_at >= ? OR COALESCE(resolved_at, created_at) >= ?' : '';

  return {
    exported_at: new Date().toISOString(),
    language: _currentLanguage,
    since,
    card_states: query<CardState>(`SELECT * FROM card_states ${cardWhere}`, since ? [since] : []),
    review_logs: query<ReviewLog>(`SELECT * FROM review_logs ${eventWhere}`, since ? [since] : []),
    sessions: query<Session>(`SELECT * FROM sessions ${sessionWhere}`, since ? [since] : []),
    unit_progress: query<UnitProgress>('SELECT * FROM unit_progress'),
    review_notes: query<ReviewNote>(`SELECT * FROM review_notes ${noteWhere}`, since ? [since, since] : []),
  };
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
    placement_only: (row.placement_only as number) === 1,
    example_sentences: JSON.parse(row.example_sentences as string),
    morpheme_breakdown: row.morpheme_breakdown ? JSON.parse(row.morpheme_breakdown as string) : undefined,
    senses: row.senses ? JSON.parse(row.senses as string) : undefined,
  } as unknown as Card;
}

// ─── Card States ──────────────────────────────────────────────────────────────

export async function upsertCardState(state: CardState): Promise<void> {
  // NOTE: `starred` is intentionally omitted here — it is owned solely by
  // setCardStarred(), so a review write can never clobber a user's star.
  run(
    `INSERT INTO card_states
       (card_id, depth_level, stability, difficulty, retrievability,
        last_review, next_review, review_count, lapse_count,
        consecutive_correct, fast_learn_level, fast_learn_fail_count,
        response_time_avg_ms)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(card_id) DO UPDATE SET
       depth_level = excluded.depth_level, stability = excluded.stability,
       difficulty = excluded.difficulty, retrievability = excluded.retrievability,
       last_review = excluded.last_review, next_review = excluded.next_review,
       review_count = excluded.review_count, lapse_count = excluded.lapse_count,
       consecutive_correct = excluded.consecutive_correct,
       fast_learn_level = excluded.fast_learn_level,
       fast_learn_fail_count = excluded.fast_learn_fail_count,
       response_time_avg_ms = excluded.response_time_avg_ms`,
    [
      state.card_id, state.depth_level, state.stability, state.difficulty,
      state.retrievability, state.last_review, state.next_review,
      state.review_count, state.lapse_count, state.consecutive_correct,
      state.fast_learn_level, state.fast_learn_fail_count,
      state.response_time_avg_ms ?? null,
    ],
  );
}

export async function setCardStarred(cardId: string, starred: boolean): Promise<void> {
  // Sole writer of `starred`. Ensure a row exists first so starring a card that
  // has no state yet still persists (all other columns have table defaults).
  run('INSERT OR IGNORE INTO card_states (card_id) VALUES (?)', [cardId]);
  run('UPDATE card_states SET starred = ? WHERE card_id = ?', [starred ? 1 : 0, cardId]);
}

// ─── Session query helpers ────────────────────────────────────────────────────

function buildState(row: Record<string, unknown>): CardState {
  return {
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
    response_time_avg_ms: (row.response_time_avg_ms as number | null) ?? null,
    starred: (row.starred as number) === 1,
  };
}

function buildCardWithState(row: Record<string, unknown>): CardWithState {
  return { ...parseCard(row), state: buildState(row) };
}

export async function getDueCards(nowIso: string): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, ${CARD_COLS}
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.next_review <= ? AND cs.depth_level >= 2
       AND (c.placement_only = 0 OR c.placement_only IS NULL)
     ORDER BY cs.next_review ASC`,
    [nowIso],
  ).map(buildCardWithState);
}

export async function getNewCards(limit: number): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, ${CARD_COLS}
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.depth_level = 1
       AND (c.placement_only = 0 OR c.placement_only IS NULL)
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
    `SELECT c.*, ${CARD_COLS}
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.depth_level IN (2.5, 4, 4.5, 5.1, 5.2, 5.3)
       AND (c.placement_only = 0 OR c.placement_only IS NULL)`,
  ).map(buildCardWithState);
}

export async function getIntroducedCards(): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, ${CARD_COLS}
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.depth_level >= 2
       AND (c.placement_only = 0 OR c.placement_only IS NULL)
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
    `SELECT c.*, ${CARD_COLS}
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.depth_level IN (1, 2, 2.5, 3)
       AND (c.placement_only = 0 OR c.placement_only IS NULL)
     ORDER BY cs.depth_level DESC, c.frequency_rank ASC`,
  ).map(buildCardWithState);
}

// Cards that have been starred by the user
export async function getStarredCards(): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, ${CARD_COLS}
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.starred = 1
       AND (c.placement_only = 0 OR c.placement_only IS NULL)
     ORDER BY cs.depth_level DESC, c.frequency_rank ASC`,
  ).map(buildCardWithState);
}

// ─── Placement test (B-04 / C-05) ────────────────────────────────────────────

export async function getPlacementCards(): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, ${CARD_COLS}
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE c.placement_only = 1
     ORDER BY c.frequency_rank ASC`,
  ).map(buildCardWithState);
}

// Marks all regular cards in units before startOrderIndex as mastered so they skip the SRS queue.
export async function applyPlacementResult(startOrderIndex: number): Promise<void> {
  if (startOrderIndex <= 0) return;
  const farFuture = new Date(Date.now() + 10 * 365 * 86400000).toISOString();
  run(
    `UPDATE card_states
     SET depth_level = 5.3, next_review = ?, stability = 365, difficulty = 0.3,
         retrievability = 0.9, review_count = 1, consecutive_correct = 3, lapse_count = 0
     WHERE card_id IN (
       SELECT c.id FROM cards c
       JOIN units u ON u.id = c.unit_id
       WHERE u.order_index < ? AND (c.placement_only = 0 OR c.placement_only IS NULL)
     )`,
    [farFuture, startOrderIndex],
  );
}

// Returns the unit whose order_index is closest to (and >= ) the given index.
export async function getUnitAtOrAfter(orderIndex: number): Promise<Unit | null> {
  const rows = query<Record<string, unknown>>(
    `SELECT * FROM units WHERE order_index >= ? AND id != 'unit-00-placement' AND (track IS NULL OR track = 'vocabulary') ORDER BY order_index ASC LIMIT 1`,
    [orderIndex],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    ...r,
    prerequisite_ids: JSON.parse(r.prerequisite_ids as string),
  } as unknown as Unit;
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
    `SELECT c.*, ${CARD_COLS}
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE c.unit_id = ?
     ORDER BY cs.depth_level ASC, c.frequency_rank ASC`,
    [unitId],
  ).map(buildCardWithState);
}

// ─── Card Gallery (D-03) ─────────────────────────────────────────────────────

// statusFilter: '' | 'new' | 'learning' | 'known' | 'mastered' | 'starred'
export async function searchGalleryCards(
  searchQuery: string,
  typeFilter:   string,
  unitId:       string,
  statusFilter: string,
  limit = 500,
): Promise<CardWithState[]> {
  const like = `%${searchQuery}%`;
  const params: Param[] = [like, like];
  let where = `(c.swahili LIKE ? OR c.english LIKE ?) AND (c.placement_only = 0 OR c.placement_only IS NULL)`;
  if (typeFilter) { where += ` AND c.type = ?`; params.push(typeFilter); }
  if (unitId)     { where += ` AND c.unit_id = ?`; params.push(unitId); }
  if (statusFilter === 'new') {
    where += ` AND cs.depth_level = 1`;
  } else {
    where += ` AND cs.depth_level > 1`;
    if (statusFilter === 'learning') { where += ` AND cs.depth_level IN (2, 2.5)`; }
    if (statusFilter === 'known')    { where += ` AND cs.depth_level IN (3, 4, 4.5)`; }
    if (statusFilter === 'mastered') { where += ` AND cs.depth_level IN (5.1, 5.2, 5.3)`; }
    if (statusFilter === 'starred')  { where += ` AND cs.starred = 1`; }
  }
  params.push(limit);
  return query<Record<string, unknown>>(
    `SELECT c.*, ${CARD_COLS}
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE ${where}
     ORDER BY c.frequency_rank ASC, c.swahili ASC
     LIMIT ?`,
    params,
  ).map(buildCardWithState);
}

export async function getVerbConjugations(verbRoot: string): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, ${CARD_COLS}
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE c.verb_root = ? AND c.type = 'conjugation'
     ORDER BY c.conjugation_key ASC`,
    [verbRoot],
  ).map(buildCardWithState);
}

// ─── Morpheme Mastery (A-03) ──────────────────────────────────────────────────

export async function updateMorphemeMastery(
  morpheme: string,
  slot: string,
  wasCorrect: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  run(
    `INSERT INTO morpheme_mastery (morpheme, slot, opportunities, correct, updated_at)
     VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(morpheme, slot) DO UPDATE SET
       opportunities = morpheme_mastery.opportunities + 1,
       correct       = morpheme_mastery.correct + excluded.correct,
       updated_at    = excluded.updated_at`,
    [morpheme, slot, wasCorrect ? 1 : 0, now],
  );
}

export async function getMorphemeMastery(): Promise<Map<string, Map<string, number>>> {
  const rows = query<MorphemeMastery>('SELECT * FROM morpheme_mastery');
  const map = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!map.has(row.slot)) map.set(row.slot, new Map());
    const rate = row.opportunities > 0 ? row.correct / row.opportunities : 0;
    map.get(row.slot)!.set(row.morpheme, rate);
  }
  return map;
}

// ─── Human review pipeline (B-06) ────────────────────────────────────────────

export type ReviewFilter = 'generated' | 'all' | 'vocabulary' | 'phrase' | 'grammar' | 'conjugation';

export async function getReviewQueue(filter: ReviewFilter): Promise<Card[]> {
  let where: string;
  if (filter === 'generated') {
    where = `c.source = 'generated'`;
  } else if (filter === 'all') {
    where = `c.source IN ('generated','reviewed')`;
  } else {
    where = `c.source IN ('generated','reviewed') AND c.type = '${filter}'`;
  }
  return query<Record<string, unknown>>(
    `SELECT * FROM cards c
     WHERE ${where}
     ORDER BY CASE c.source WHEN 'generated' THEN 0 ELSE 1 END ASC, c.frequency_rank ASC`,
  ).map(parseCard);
}

function ensureCurriculumInstallMetadata(lang: string): void {
  const cfg = getLanguage(lang);
  const now = new Date().toISOString();
  run(
    `INSERT INTO curriculum_packages
       (language, package_version, template_db, installed_scope, installed_at, updated_at)
     VALUES (?, ?, ?, 'all', ?, ?)
     ON CONFLICT(language) DO UPDATE SET
       package_version = excluded.package_version,
       template_db = excluded.template_db,
       updated_at = excluded.updated_at`,
    [cfg.id, cfg.curriculumVersion, cfg.templateDb, now, now],
  );
  run(
    `INSERT OR IGNORE INTO curriculum_unit_versions
       (language, unit_id, unit_version, installed_at)
     SELECT ?, id, 1, ? FROM units`,
    [cfg.id, now],
  );
}

export async function getReviewCard(cardId: string): Promise<Card | null> {
  const rows = query<Record<string, unknown>>(
    `SELECT * FROM cards c
     WHERE c.id = ?`,
    [cardId],
  );
  return rows[0] ? parseCard(rows[0]) : null;
}

export interface ReviewUpdate {
  english:      string;
  pronunciation: string;
  register:     string;
  cultural_note: string;
}

export type ReviewIssueType =
  | 'translation'
  | 'pronunciation'
  | 'cultural_note'
  | 'register'
  | 'example'
  | 'grammar'
  | 'other';

export interface ReviewNote {
  id: string;
  card_id: string;
  language: string;
  issue_type: ReviewIssueType;
  note: string;
  suggested_correction: string | null;
  reviewer: string | null;
  status: 'open' | 'accepted' | 'rejected';
  created_at: string;
  resolved_at: string | null;
}

export interface ReviewNoteInput {
  card_id: string;
  language: string;
  issue_type: ReviewIssueType;
  note: string;
  suggested_correction?: string | null;
  reviewer?: string | null;
}

export async function saveReviewedCard(id: string, updates: ReviewUpdate): Promise<void> {
  run(
    `UPDATE cards SET
       english = ?, pronunciation = ?, register = ?, cultural_note = ?, source = 'reviewed'
     WHERE id = ?`,
    [updates.english, updates.pronunciation, updates.register, updates.cultural_note || null, id],
  );
}

export async function saveReviewNote(input: ReviewNoteInput): Promise<ReviewNote> {
  const now = new Date().toISOString();
  const note: ReviewNote = {
    id: `rn_${now.replace(/\D/g, '')}_${Math.random().toString(36).slice(2, 8)}`,
    card_id: input.card_id,
    language: input.language,
    issue_type: input.issue_type,
    note: input.note.trim(),
    suggested_correction: input.suggested_correction?.trim() || null,
    reviewer: input.reviewer?.trim() || null,
    status: 'open',
    created_at: now,
    resolved_at: null,
  };
  if (!note.note && !note.suggested_correction) return note;
  run(
    `INSERT INTO review_notes
       (id, card_id, language, issue_type, note, suggested_correction, reviewer, status, created_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      note.id, note.card_id, note.language, note.issue_type, note.note,
      note.suggested_correction, note.reviewer, note.status, note.created_at, note.resolved_at,
    ],
  );
  return note;
}

export async function getReviewNotesForCard(cardId: string): Promise<ReviewNote[]> {
  return query<ReviewNote>(
    `SELECT * FROM review_notes
     WHERE card_id = ?
     ORDER BY created_at DESC`,
    [cardId],
  );
}

export async function exportReviewNotes(): Promise<Array<ReviewNote & { target: string; english: string; unit_id: string; type: string }>> {
  return query<ReviewNote & { target: string; english: string; unit_id: string; type: string }>(
    `SELECT rn.*, c.swahili as target, c.english, c.unit_id, c.type
     FROM review_notes rn
     LEFT JOIN cards c ON c.id = rn.card_id
     ORDER BY rn.created_at DESC`,
  );
}

export async function getReviewStats(): Promise<{ reviewed: number; generated: number }> {
  const rows = query<{ source: string; cnt: number }>(
    `SELECT source, COUNT(*) as cnt FROM cards
     WHERE source IN ('generated','reviewed')
     GROUP BY source`,
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[r.source] = r.cnt;
  return { reviewed: map['reviewed'] ?? 0, generated: map['generated'] ?? 0 };
}

// ─── Remote DB merge ──────────────────────────────────────────────────────────
//
// Merges a remote SQLite binary (from Drive) into the currently open local DB.
// Row-level rules per table — no progress is ever discarded.

type MergeRow = (string | number | null | Uint8Array)[];

/** Build a column-name → index map for a sql.js exec result. */
function _mci(columns: string[]): (n: string) => number {
  const m: Record<string, number> = {};
  columns.forEach((c, i) => { m[c] = i; });
  return n => m[n] ?? -1;
}

/** Returns the lexicographically earlier ISO date string, ignoring nulls. */
function _minIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

/**
 * card_states — winner is whichever side has higher review_count.
 * starred is OR'd: once starred on either device it stays starred.
 */
function _mergeCardStates(local: Database, remote: Database): void {
  // Load all local state that has been interacted with
  const localMap = new Map<string, { count: number; starred: number }>();
  for (const sql of [
    'SELECT card_id, review_count, COALESCE(starred,0) FROM card_states WHERE review_count > 0 OR COALESCE(starred,0)=1',
    'SELECT card_id, review_count, 0 FROM card_states WHERE review_count > 0',
  ]) {
    try {
      const lr = local.exec(sql);
      if (lr.length && lr[0].values.length) {
        for (const [id, cnt, star] of lr[0].values)
          localMap.set(id as string, { count: cnt as number, starred: star as number });
        break;
      }
    } catch { continue; }
  }

  // Load remote rows that carry any progress
  let remoteRes: ReturnType<Database['exec']> = [];
  for (const sql of [
    'SELECT * FROM card_states WHERE review_count > 0 OR COALESCE(starred,0)=1',
    'SELECT * FROM card_states WHERE review_count > 0',
  ]) {
    try { remoteRes = remote.exec(sql); if (remoteRes.length) break; }
    catch { continue; }
  }
  if (!remoteRes.length || !remoteRes[0].values.length) return;

  const { columns, values } = remoteRes[0];
  const c = _mci(columns);

  for (const row of values as MergeRow[]) {
    const cardId       = row[c('card_id')] as string;
    const remoteCount  = (row[c('review_count')] as number) ?? 0;
    const remoteStarred = c('starred') >= 0 ? ((row[c('starred')] as number) ?? 0) : 0;

    const loc = localMap.get(cardId);
    const localCount   = loc?.count   ?? 0;
    const localStarred = loc?.starred ?? 0;
    const mergedStarred = Math.max(localStarred, remoteStarred);

    if (remoteCount > localCount) {
      local.run(
        `UPDATE card_states SET
           depth_level=?,stability=?,difficulty=?,retrievability=?,
           last_review=?,next_review=?,review_count=?,lapse_count=?,
           consecutive_correct=?,fast_learn_level=?,fast_learn_fail_count=?,
           response_time_avg_ms=?,starred=?
         WHERE card_id=?`,
        [
          row[c('depth_level')], row[c('stability')], row[c('difficulty')], row[c('retrievability')],
          row[c('last_review')], row[c('next_review')], remoteCount, row[c('lapse_count')],
          row[c('consecutive_correct')], row[c('fast_learn_level')], row[c('fast_learn_fail_count')],
          c('response_time_avg_ms') >= 0 ? row[c('response_time_avg_ms')] : null,
          mergedStarred, cardId,
        ],
      );
    } else if (mergedStarred !== localStarred) {
      local.run('UPDATE card_states SET starred=? WHERE card_id=?', [mergedStarred, cardId]);
    }
  }
}

/**
 * sessions & review_logs — append-only event logs.
 * INSERT OR IGNORE ensures no duplicates; nothing is ever removed.
 */
function _mergeAppendOnly(local: Database, remote: Database, table: string): void {
  let res: ReturnType<Database['exec']>;
  try { res = remote.exec(`SELECT * FROM ${table}`); }
  catch { return; }
  if (!res.length || !res[0].values.length) return;

  const { columns, values } = res[0];
  const cols = columns.join(',');
  const placeholders = columns.map(() => '?').join(',');

  for (const row of values as MergeRow[]) {
    try {
      local.run(`INSERT OR IGNORE INTO ${table} (${cols}) VALUES (${placeholders})`, row);
    } catch { /* incompatible schema — skip row */ }
  }
}

/**
 * skill_mastery & morpheme_mastery — take the row with higher opportunities.
 */
function _mergeByOpportunities(
  local: Database,
  remote: Database,
  table: string,
  pkCols: string[],
): void {
  let res: ReturnType<Database['exec']>;
  try { res = remote.exec(`SELECT * FROM ${table}`); }
  catch { return; }
  if (!res.length || !res[0].values.length) return;

  const { columns, values } = res[0];
  const c = _mci(columns);
  const cols = columns.join(',');
  const placeholders = columns.map(() => '?').join(',');
  const where = pkCols.map(pk => `${pk}=?`).join(' AND ');
  const nonPk = columns.filter(col => !pkCols.includes(col));
  const setClause = nonPk.map(col => `${col}=?`).join(',');

  for (const row of values as MergeRow[]) {
    const pkVals = pkCols.map(pk => row[c(pk)]);
    const remoteOpp = (row[c('opportunities')] as number) ?? 0;
    try {
      const lr = local.exec(`SELECT opportunities FROM ${table} WHERE ${where}`, pkVals);
      if (!lr.length || !lr[0].values.length) {
        local.run(`INSERT OR IGNORE INTO ${table} (${cols}) VALUES (${placeholders})`, row);
      } else if (remoteOpp > ((lr[0].values[0][0] as number) ?? 0)) {
        local.run(
          `UPDATE ${table} SET ${setClause} WHERE ${where}`,
          [...nonPk.map(col => row[c(col)]), ...pkVals],
        );
      }
    } catch { /* skip */ }
  }
}

/**
 * error_patterns — take the row with the higher count.
 */
function _mergeErrorPatterns(local: Database, remote: Database): void {
  let res: ReturnType<Database['exec']>;
  try { res = remote.exec('SELECT * FROM error_patterns'); }
  catch { return; }
  if (!res.length || !res[0].values.length) return;

  const { columns, values } = res[0];
  const c = _mci(columns);
  const cols = columns.join(',');
  const p = columns.map(() => '?').join(',');

  for (const row of values as MergeRow[]) {
    const skillTag  = row[c('skill_tag')] as string;
    const errorType = row[c('error_type')] as string;
    const remoteCount = (row[c('count')] as number) ?? 0;
    try {
      const lr = local.exec(
        'SELECT count FROM error_patterns WHERE skill_tag=? AND error_type=?',
        [skillTag, errorType],
      );
      if (!lr.length || !lr[0].values.length) {
        local.run(`INSERT OR IGNORE INTO error_patterns (${cols}) VALUES (${p})`, row);
      } else if (remoteCount > ((lr[0].values[0][0] as number) ?? 0)) {
        local.run(
          'UPDATE error_patterns SET count=?,updated_at=? WHERE skill_tag=? AND error_type=?',
          [remoteCount, row[c('updated_at')], skillTag, errorType],
        );
      }
    } catch { /* skip */ }
  }
}

/**
 * unit_progress — completed > in_progress > available > locked.
 * Earliest started_at and completed_at timestamps are kept.
 */
function _mergeUnitProgress(local: Database, remote: Database): void {
  const STATUS_RANK: Record<string, number> = { locked: 0, available: 1, in_progress: 2, completed: 3 };

  let res: ReturnType<Database['exec']>;
  try { res = remote.exec('SELECT * FROM unit_progress'); }
  catch { return; }
  if (!res.length || !res[0].values.length) return;

  const { columns, values } = res[0];
  const c = _mci(columns);
  const cols = columns.join(',');
  const p = columns.map(() => '?').join(',');

  for (const row of values as MergeRow[]) {
    const unitId        = row[c('unit_id')] as string;
    const remoteStatus  = row[c('status')] as string;
    const remoteRank    = STATUS_RANK[remoteStatus] ?? 0;
    const remoteMastery = (row[c('mastery_score')] as number) ?? 0;

    try {
      const lr = local.exec(
        'SELECT status, started_at, completed_at, mastery_score FROM unit_progress WHERE unit_id=?',
        [unitId],
      );
      if (!lr.length || !lr[0].values.length) {
        local.run(`INSERT OR IGNORE INTO unit_progress (${cols}) VALUES (${p})`, row);
        continue;
      }
      const [localStatus, localStarted, localCompleted, localMastery] = lr[0].values[0];
      const localRank    = STATUS_RANK[localStatus as string] ?? 0;
      const bestMastery  = Math.max((localMastery as number) ?? 0, remoteMastery);
      const mergedStart  = _minIso(localStarted as string | null, row[c('started_at')] as string | null);
      const mergedDone   = _minIso(localCompleted as string | null, row[c('completed_at')] as string | null);

      if (remoteRank > localRank) {
        local.run(
          'UPDATE unit_progress SET status=?,started_at=?,completed_at=?,mastery_score=? WHERE unit_id=?',
          [remoteStatus, mergedStart, mergedDone, bestMastery, unitId],
        );
      } else {
        local.run(
          'UPDATE unit_progress SET started_at=?,completed_at=?,mastery_score=? WHERE unit_id=?',
          [mergedStart, mergedDone, bestMastery, unitId],
        );
      }
    } catch { /* skip */ }
  }
}

/**
 * profile — max streak_longest and total_xp across both; settings from the
 * device that was more recently active.
 */
function _mergeProfile(local: Database, remote: Database): void {
  let res: ReturnType<Database['exec']>;
  try { res = remote.exec('SELECT * FROM profile'); }
  catch { return; }
  if (!res.length || !res[0].values.length) return;

  const { columns, values } = res[0];
  const c = _mci(columns);
  const remoteRow = values[0] as MergeRow;

  const remoteSettings  = remoteRow[c('settings')] as string;
  const remoteActivity  = remoteRow[c('last_activity')] as string | null;
  const remoteLongest   = (remoteRow[c('streak_longest')] as number) ?? 0;
  const remoteTotalXp   = c('total_xp') >= 0 ? ((remoteRow[c('total_xp')] as number) ?? 0) : 0;

  try {
    const lr = local.exec('SELECT last_activity, streak_longest, COALESCE(total_xp,0) FROM profile');
    if (!lr.length || !lr[0].values.length) {
      const cols = columns.join(',');
      const p = columns.map(() => '?').join(',');
      local.run(`INSERT OR REPLACE INTO profile (${cols}) VALUES (${p})`, remoteRow);
      return;
    }
    const [localActivity, , ] = lr[0].values[0];

    // Always take the best cumulative stats
    local.run(
      `UPDATE profile
         SET streak_longest = MAX(streak_longest, ?),
             total_xp       = MAX(COALESCE(total_xp,0), ?)`,
      [remoteLongest, remoteTotalXp],
    );

    // If remote was more recently active, adopt its settings
    if (remoteActivity && (!localActivity || (remoteActivity > (localActivity as string)))) {
      local.run('UPDATE profile SET settings=?', [remoteSettings]);
    }
  } catch { /* skip */ }
}

/**
 * Merges a remote DB binary into the currently open local DB.
 * Called after openDatabase(); safe to call even if Drive has no newer data.
 */
export async function mergeRemoteDb(remoteBytes: Uint8Array): Promise<{ merged: boolean }> {
  if (!_db) return { merged: false };
  const sql = await getSql();
  let remoteDb: Database | null = null;
  try {
    remoteDb = new sql.Database(remoteBytes);
    _db.run('BEGIN');
    try {
      _mergeCardStates(_db, remoteDb);
      _mergeAppendOnly(_db, remoteDb, 'sessions');
      _mergeAppendOnly(_db, remoteDb, 'review_logs');
      _mergeAppendOnly(_db, remoteDb, 'review_notes');
      _mergeByOpportunities(_db, remoteDb, 'skill_mastery', ['skill_tag']);
      _mergeByOpportunities(_db, remoteDb, 'morpheme_mastery', ['morpheme', 'slot']);
      _mergeErrorPatterns(_db, remoteDb);
      _mergeUnitProgress(_db, remoteDb);
      _mergeProfile(_db, remoteDb);
      _db.run('COMMIT');
    } catch (e) {
      try { _db.run('ROLLBACK'); } catch { /* ignore */ }
      throw e;
    }
    scheduleFlush();
    return { merged: true };
  } catch {
    return { merged: false };
  } finally {
    remoteDb?.close();
  }
}
