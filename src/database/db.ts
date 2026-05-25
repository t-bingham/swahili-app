/**
 * Web database layer — sql.js (WebAssembly SQLite) + IndexedDB persistence.
 *
 * Strategy:
 *   - Template DB (all cards, initial card_states) is bundled at /swahili_default.db
 *   - Each user gets their own copy in IndexedDB keyed by username
 *   - On open: load from IndexedDB; if absent, fetch template and copy it
 *   - After every write: flush to IndexedDB (debounced)
 */

import pluralize from 'pluralize';
import type { Database, SqlJsStatic } from 'sql.js';
import type {
  Card, CardState, CardWithState, Profile, ProfileSettings,
  Session, ReviewLog, Unit, UnitProgress, ErrorType, MorphemeMastery,
} from '../types';
import { PLACEMENT_SEEDS, PHRASE_SEEDS, GRAMMAR_SEEDS } from './seeds';
import { NOUN_CLASS_MAP } from '../data/nounClasses';

// ─── Plural-English migration helpers (used once per existing user DB) ────────

const _PLURAL_OVERRIDES: Record<string, string> = {
  loaf: 'loaves', leaf: 'leaves', beef: 'beef', luggage: 'luggage',
  merchandise: 'merchandise', police: 'police', blood: 'blood',
  sunshine: 'sunshine', poetry: 'poetry', pay: 'pay',
  brightness: 'brightness', amnesty: 'amnesty', aid: 'aid',
  mourning: 'mourning', bereavement: 'bereavement',
};
const _PLURAL_STOP = new Set([
  'of','the','a','an','for','in','at','on','to','with','from','by','and','or',
  'etc.','one','large','medical','romantic','physical','small','own','old',
  'thick','printed','east','african','currency','water','flatbread','bank',
  'id','long','short','singular',
]);

function _pluralWord(w: string): string {
  const lo = w.toLowerCase();
  if (_PLURAL_STOP.has(lo)) return w;
  if (_PLURAL_OVERRIDES[lo]) return _PLURAL_OVERRIDES[lo];
  return pluralize(w);
}
function _pluralQualifier(q: string): string {
  if (q.includes('etc.') || (q.includes(',') && !q.includes("'"))) return q;
  if (/^(of|from|for|in|at|on|with|by)\b/i.test(q)) return q;
  if (!q.includes(' ') && _PLURAL_STOP.has(q.toLowerCase())) return q;
  const pm = q.match(/^(.+'s)\s+(.+)$/);
  if (pm) return `${pm[1]} ${_pluralWord(pm[2])}`;
  const ws = q.split(' ');
  ws[ws.length - 1] = _pluralWord(ws[ws.length - 1]);
  return ws.join(' ');
}
function _pluralPart(part: string): string {
  const m = part.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return `${_pluralWord(m[1].trim())} (${_pluralQualifier(m[2].trim())})`;
  return _pluralWord(part);
}
function _fixPluralEnglish(en: string): string | null {
  if (!en.endsWith(' (plural)')) return null;
  const core = en.slice(0, -9);
  const si = core.indexOf(' ');
  if (si === -1) return null;
  const adj = core.slice(0, si);
  const noun = core.slice(si + 1).trim();
  const fixed = noun.split(' / ').map(s => _pluralPart(s.trim())).join(' / ');
  const result = `${adj} ${fixed}`;
  // Post-fix known compound-hyphenated irregulars that pluralize mishandles
  return result
    .replace(/sibling-in-laws/g, 'siblings-in-law')
    .replace(/brother-in-laws/g, 'brothers-in-law')
    .replace(/sister-in-laws/g,  'sisters-in-law')
    .replace(/parent-in-laws/g,  'parents-in-law')
    .replace(/child-in-laws/g,   'children-in-law');
}

// ── Pluralise a "plural of X" base phrase (used by E-02 migration) ────────────
function _pluralizeBase(base: string): string {
  return base.split(' / ').map(seg => _pluralPart(seg.trim())).join(' / ');
}

// ── Conjugation English reform helpers (used by E-01 migration) ──────────────

const _CI_PAST: Record<string, string> = {
  be:'was/were', become:'became', begin:'began', break:'broke', bring:'brought',
  build:'built', buy:'bought', choose:'chose', come:'came', cut:'cut', do:'did',
  draw:'drew', drink:'drank', drive:'drove', eat:'ate', fall:'fell', feel:'felt',
  fight:'fought', find:'found', flee:'fled', fly:'flew', forget:'forgot',
  forgive:'forgave', get:'got', give:'gave', go:'went', grow:'grew', have:'had',
  hear:'heard', hit:'hit', hold:'held', keep:'kept', know:'knew', lay:'laid',
  lead:'led', leap:'leapt', leave:'left', let:'let', lie:'lay', lose:'lost',
  make:'made', mean:'meant', overcome:'overcame', pay:'paid', put:'put',
  quit:'quit', read:'read', run:'ran', say:'said', see:'saw', sell:'sold',
  send:'sent', shine:'shone', show:'showed', sing:'sang', sit:'sat',
  sleep:'slept', speak:'spoke', spend:'spent', spread:'spread', stand:'stood',
  stink:'stank', swim:'swam', take:'took', teach:'taught', tell:'told',
  think:'thought', throw:'threw', understand:'understood', wake:'woke',
  wear:'wore', weep:'wept', win:'won', write:'wrote',
};
const _CI_PP: Record<string, string> = {
  be:'been', become:'become', begin:'begun', break:'broken', bring:'brought',
  build:'built', buy:'bought', choose:'chosen', come:'come', cut:'cut', do:'done',
  draw:'drawn', drink:'drunk', drive:'driven', eat:'eaten', fall:'fallen',
  feel:'felt', fight:'fought', find:'found', flee:'fled', fly:'flown',
  forget:'forgotten', forgive:'forgiven', get:'gotten', give:'given', go:'gone',
  grow:'grown', have:'had', hear:'heard', hit:'hit', hold:'held', keep:'kept',
  know:'known', lay:'laid', lead:'led', leap:'leapt', leave:'left', let:'let',
  lie:'lain', lose:'lost', make:'made', mean:'meant', overcome:'overcome',
  pay:'paid', put:'put', quit:'quit', read:'read', run:'run', say:'said',
  see:'seen', sell:'sold', send:'sent', shine:'shone', show:'shown', sing:'sung',
  sit:'sat', sleep:'slept', speak:'spoken', spend:'spent', spread:'spread',
  stand:'stood', stink:'stunk', swim:'swum', take:'taken', teach:'taught',
  tell:'told', think:'thought', throw:'thrown', understand:'understood',
  wake:'woken', wear:'worn', weep:'wept', win:'won', write:'written',
};
const _CI_DOUBLES = new Set([
  'begin','chat','cut','drop','fit','forget','get','grab','hit','hop','hug',
  'jog','let','mop','nod','pat','plan','plug','pop','put','run','set','sit',
  'skip','slam','slap','slip','snap','sob','spin','stop','stun','swim','tap',
  'tip','tug','win','wrap',
]);
const _CI_SKIP_MODAL = new Set(['can','may','might','shall','will','would','could','should']);

function _ciGerundize(word: string): string {
  const sp = word.indexOf(' ');
  if (sp !== -1) return _ciGerundize(word.slice(0, sp)) + word.slice(sp);
  const OV: Record<string,string> = { be:'being', lie:'lying', die:'dying', tie:'tying' };
  if (OV[word]) return OV[word];
  if (word.endsWith('ie')) return word.slice(0, -2) + 'ying';
  if (_CI_DOUBLES.has(word)) return word + word[word.length - 1] + 'ing';
  if (word.endsWith('e') && !/[eoy]e$/.test(word)) return word.slice(0, -1) + 'ing';
  return word + 'ing';
}
function _ciPast(word: string): string {
  if (_CI_PAST[word]) return _CI_PAST[word];
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return word.slice(0, -1) + 'ied';
  if (word.endsWith('e')) return word + 'd';
  if (_CI_DOUBLES.has(word)) return word + word[word.length - 1] + 'ed';
  return word + 'ed';
}
function _ciPP(word: string): string {
  if (_CI_PP[word]) return _CI_PP[word];
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return word.slice(0, -1) + 'ied';
  if (word.endsWith('e')) return word + 'd';
  if (_CI_DOUBLES.has(word)) return word + word[word.length - 1] + 'ed';
  return word + 'ed';
}

const _CI_BE_PRES: Record<string,string> = { 'I':'am','you':'are','he/she':'is','we':'are','you all':'are','they':'are' };
const _CI_BE_PAST: Record<string,string> = { 'I':'was','you':'were','he/she':'was','we':'were','you all':'were','they':'were' };
const _CI_HAVE:    Record<string,string> = { 'I':'have','you':'have','he/she':'has','we':'have','you all':'have','they':'have' };
const _CI_HAVENT:  Record<string,string> = { 'I':"haven't",'you':"haven't",'he/she':"hasn't",'we':"haven't",'you all':"haven't",'they':"haven't" };

function _ciBuildSingle(subject: string, tense: string, alt: string): string | null {
  const stripped = alt.replace(/^to\s+/, '').trim();
  const mv = stripped.split(' ')[0];
  const rest = stripped.slice(mv.length);
  const isBe = mv === 'be';
  const ger  = isBe ? 'being' : (_ciGerundize(mv) + rest);
  const past = isBe ? (_CI_BE_PAST[subject] + rest) : (_ciPast(mv) + rest);
  const pp   = isBe ? ('been' + rest) : (_ciPP(mv) + rest);
  const base = stripped;
  const t    = tense.toLowerCase().replace(/\s+/g, '_');
  switch (t) {
    case 'present':          return isBe ? `${subject} ${_CI_BE_PRES[subject]}${rest}` : `${subject} ${_CI_BE_PRES[subject]} ${ger}`;
    case 'past':             return `${subject} ${past}`;
    case 'future':           return `${subject} will ${base}`;
    case 'perfect':          return isBe ? `${subject} ${_CI_HAVE[subject]} been${rest}` : `${subject} ${_CI_HAVE[subject]} ${pp}`;
    case 'habitual':         return isBe ? `${subject} ${_CI_BE_PRES[subject]} usually${rest}` : `${subject} usually ${base}`;
    case 'subjunctive':      return `${subject} should ${base}`;
    case 'neg_present':      return isBe ? `${subject} ${_CI_BE_PRES[subject]} not${rest}` : `${subject} ${_CI_BE_PRES[subject]} not ${ger}`;
    case 'neg_past':         return `${subject} didn't ${base}`;
    case 'neg_perfect':      return `${subject} ${_CI_HAVENT[subject]} ${pp}`;
    case 'conditional':      return `${subject} would ${base}`;
    case 'conditional_past': return isBe ? `${subject} would have been${rest}` : `${subject} would have ${pp}`;
    default:                 return null;
  }
}

function _ciTransform(english: string): string | null {
  const objM = english.match(/^(\[object infix -[^-]+-\])\s+(I|you|he\/she|we|you pl|they)\s+\[([^\]]+)\]\s+(.+)$/);
  const regM = !objM && english.match(/^(I|you|he\/she|we|you pl|they)\s+\[([^\]]+)\]\s+(.+)$/);
  const [objPrefix, rawSubj, tense, verbPhrase] = objM
    ? [objM[1], objM[2], objM[3], objM[4]]
    : regM ? ['', regM[1], regM[2], regM[3]] : ['', '', '', ''];
  if (!tense) return null;
  const subject = rawSubj === 'you pl' ? 'you all' : rawSubj;
  // Parse slash-separated alternatives; skip pure modals (can, may, etc.)
  const alts = verbPhrase.split(/\s*\/\s*/).map(a => a.trim()).filter(a => a);
  const filtered = alts.filter(a => !_CI_SKIP_MODAL.has(a.replace(/^to\s+/, '').trim()));
  const active = filtered.length ? filtered : alts;
  const results = active.map(a => _ciBuildSingle(subject, tense, a));
  if (results.some(r => !r)) return null;
  // Compress shared prefix: "I am reading / I am studying" → "I am reading / studying"
  let out = results as string[];
  if (out.length >= 2) {
    const ws0 = out[0].split(' ');
    const allWs = out.map(r => r.split(' '));
    let cn = 0;
    outer: for (let i = 0; i < ws0.length; i++) {
      for (const ws of allWs) { if (i >= ws.length || ws[i] !== ws0[i]) break outer; }
      cn++;
    }
    if (cn >= 2) {
      const prefix = ws0.slice(0, cn).join(' ');
      const suffixes = out.map(r => r.slice(prefix.length).trim()).filter(s => s);
      if (suffixes.length === out.length) out = [`${prefix} ${suffixes.join(' / ')}`];
    }
  }
  const natural = out.join(' / ');
  return objPrefix ? `${objPrefix} ${natural}` : natural;
}

const DEFAULT_NEW_WORDS_PER_DAY = 10;
const DEFAULT_REVIEWS_PER_DAY = 20;

// ─── Swahili rule-based syllabifier ───────────────────────────────────────────
// Used to back-fill the pronunciation field for existing users on migration.

const _VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const _CLUSTERS = [
  "ng'", 'ny', 'sh', 'ch', 'dh', 'gh', 'kh', 'th',
  'mb',  'nd', 'nj', 'nk', 'nt', 'nz', 'mv',
];

function syllabify(word: string): string {
  const w = word.toLowerCase();
  const syllables: string[] = [];
  let i = 0;
  while (i < w.length) {
    let syl = '';
    while (i < w.length && !_VOWELS.has(w[i])) {
      let matched = false;
      for (const cl of _CLUSTERS) {
        if (w.startsWith(cl, i)) { syl += cl; i += cl.length; matched = true; break; }
      }
      if (!matched) syl += w[i++];
    }
    if (i < w.length && _VOWELS.has(w[i])) syl += w[i++];
    if (syl) syllables.push(syl);
  }
  if (!syllables.length) return word;
  const stressAt = syllables.length >= 2 ? syllables.length - 2 : 0;
  return syllables.map((s, idx) => idx === stressAt ? s.toUpperCase() : s).join('-');
}

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
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
const LEGACY_MIGRATION_VERSION = 1;

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

  ensureMigrationTable(_db);
  if (getMigrationVersion(_db) < LEGACY_MIGRATION_VERSION) {
  // Legacy migration bundle — create/alter tables and content fixes added after
  // the template DB was generated. Tracked so future opens do not rerun the full
  // content repair pass on every launch.
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

  // A-01: card metadata columns
  try { _db.run("ALTER TABLE cards ADD COLUMN register TEXT DEFAULT 'neutral'"); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN morpheme_breakdown TEXT'); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN part_of_speech TEXT'); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN etymology TEXT'); } catch { /* already exists */ }
  try { _db.run("ALTER TABLE cards ADD COLUMN dialect TEXT DEFAULT 'standard'"); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN cultural_note TEXT'); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN senses TEXT'); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN placement_only INTEGER DEFAULT 0'); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN noun_class TEXT'); } catch { /* already exists */ }

  // Populate noun_class for known vocabulary words (idempotent — only sets NULL rows)
  for (const [word, cls] of Object.entries(NOUN_CLASS_MAP)) {
    _db.run(
      `UPDATE cards SET noun_class = ? WHERE swahili = ? AND type = 'vocabulary' AND noun_class IS NULL`,
      [cls, word],
    );
  }

  // A-02: response time tracking on card states
  try { _db.run('ALTER TABLE card_states ADD COLUMN response_time_avg_ms REAL'); } catch { /* already exists */ }

  // A-03: morpheme-level mastery table
  _db.run(`
    CREATE TABLE IF NOT EXISTS morpheme_mastery (
      morpheme      TEXT NOT NULL,
      slot          TEXT NOT NULL,
      opportunities INTEGER NOT NULL DEFAULT 0,
      correct       INTEGER NOT NULL DEFAULT 0,
      updated_at    TEXT NOT NULL,
      PRIMARY KEY (morpheme, slot)
    )
  `);

  // A-06: starred cards
  try { _db.run('ALTER TABLE card_states ADD COLUMN starred INTEGER DEFAULT 0'); } catch { /* already exists */ }

  // D-01: Fix "(plural)" English labels — convert "bad child (plural)" → "bad children" etc.
  // Idempotent: only touches rows that still carry the old marker.
  {
    const rows = _db.exec(
      "SELECT id, english FROM cards WHERE english LIKE '%(plural)%' AND english NOT LIKE 'you%'"
    );
    if (rows.length && rows[0].values.length) {
      _db.run('BEGIN');
      for (const [id, en] of rows[0].values as [string, string][]) {
        const fixed = _fixPluralEnglish(en);
        if (fixed) _db.run('UPDATE cards SET english = ? WHERE id = ?', [fixed, id]);
      }
      _db.run('COMMIT');
    }
  }

  // B-04: placement test seed data (idempotent — INSERT OR IGNORE)
  _db.run(`INSERT OR IGNORE INTO units
    (id, name, description, level, order_index, prerequisite_ids, grammar_notes, estimated_hours)
    VALUES ('unit-00-placement','Placement Test','Diagnostic cards used to determine your starting level',1,0,'[]','',0)`);


  for (const c of PLACEMENT_SEEDS) {
    _db.run(
      `INSERT OR IGNORE INTO cards
         (id, swahili, english, pronunciation, type, tags, base_difficulty, frequency_rank,
          quick_learn, unit_id, source, example_sentences, register, part_of_speech,
          senses, placement_only)
       VALUES (?,?,?,?,?,?,?,?,0,'unit-00-placement','handwritten',?,?,?,?,1)`,
      [c.id, c.sw, c.en, c.pr, 'vocabulary', JSON.stringify(c.tags), c.diff, c.rank,
       JSON.stringify([c.ex]), 'neutral', c.pos, JSON.stringify(c.senses)],
    );
    _db.run(
      `INSERT OR IGNORE INTO card_states
         (card_id, depth_level, stability, difficulty, retrievability,
          last_review, next_review, review_count, lapse_count,
          consecutive_correct, fast_learn_level, fast_learn_fail_count)
       VALUES (?,1,0,0.3,1,NULL,NULL,0,0,0,0,0)`,
      [c.id],
    );
  }

  // B-01: Essential Phrases unit (idempotent — INSERT OR IGNORE)
  _db.run(`INSERT OR IGNORE INTO units
    (id, name, description, level, order_index, prerequisite_ids, grammar_notes, estimated_hours)
    VALUES ('unit-00-phrases','Essential Phrases',
      'Everyday communicative phrases for real-world Swahili conversations',
      1,-1,'[]',
      'These are formulaic phrases used in daily speech. Learning them before grammar gives you immediate communicative power.',
      2)`);


  let phraseIdx = 0;
  for (const p of PHRASE_SEEDS) {
    _db.run(
      `INSERT OR IGNORE INTO cards
         (id, swahili, english, pronunciation, type, tags, base_difficulty, frequency_rank,
          quick_learn, unit_id, source, example_sentences, register, part_of_speech,
          senses, placement_only, cultural_note)
       VALUES (?,?,?,?,?,?,?,?,1,'unit-00-phrases','handwritten',?,?,?,?,0,?)`,
      [p.id, p.sw, p.en, p.pr, 'phrase', JSON.stringify(p.tags), 0.3, phraseIdx + 1,
       JSON.stringify([p.ex]), p.register, 'phrase', JSON.stringify(p.senses), p.note ?? null],
    );
    _db.run(
      `INSERT OR IGNORE INTO card_states
         (card_id, depth_level, stability, difficulty, retrievability,
          last_review, next_review, review_count, lapse_count,
          consecutive_correct, fast_learn_level, fast_learn_fail_count)
       VALUES (?,1,0,0.3,1,NULL,NULL,0,0,0,0,0)`,
      [p.id],
    );
    phraseIdx++;
  }
  // Fix frequency_rank for existing users
  _db.run(`UPDATE cards SET frequency_rank = CAST(SUBSTR(id, 5) AS INTEGER) WHERE id LIKE 'phr-%' AND unit_id = 'unit-00-phrases'`);

  // B-02: Morphological rule cards (idempotent — INSERT OR IGNORE)
  _db.run(`INSERT OR IGNORE INTO units
    (id, name, description, level, order_index, prerequisite_ids, grammar_notes, estimated_hours)
    VALUES ('unit-00-grammar','Morphology Rules',
      'The building blocks that generate Swahili verb conjugations and noun agreement',
      1,-2,'[]',
      'Swahili is agglutinative — words are built by stacking morpheme slots. Mastering these ~20 slots lets you generate any conjugation rather than memorising each form individually.',
      3)`);


  let grammarIdx = 0;
  for (const g of GRAMMAR_SEEDS) {
    _db.run(
      `INSERT OR IGNORE INTO cards
         (id, swahili, english, pronunciation, type, tags, base_difficulty, frequency_rank,
          quick_learn, unit_id, source, example_sentences, register, part_of_speech,
          senses, placement_only, cultural_note)
       VALUES (?,?,?,?,?,?,?,?,1,'unit-00-grammar','handwritten',?,?,?,?,0,?)`,
      [g.id, g.sw, g.en, g.pr, 'grammar', JSON.stringify(g.tags), 0.4, grammarIdx + 1,
       JSON.stringify([g.ex]), 'neutral', 'particle',
       JSON.stringify([{english: g.en}]), g.note],
    );
    _db.run(
      `INSERT OR IGNORE INTO card_states
         (card_id, depth_level, stability, difficulty, retrievability,
          last_review, next_review, review_count, lapse_count,
          consecutive_correct, fast_learn_level, fast_learn_fail_count)
       VALUES (?,1,0,0.3,1,NULL,NULL,0,0,0,0,0)`,
      [g.id],
    );
    grammarIdx++;
  }
  // Fix frequency_rank for existing users (INSERT OR IGNORE won't update already-inserted rows)
  _db.run(`UPDATE cards SET frequency_rank = CAST(SUBSTR(id, 4) AS INTEGER) WHERE id LIKE 'gr-%' AND unit_id = 'unit-00-grammar'`);

  // Sync improved grammar card content for existing users (idempotent; small fixed seed set).
  for (const g of GRAMMAR_SEEDS) {
    _db.run(`UPDATE cards SET english = ?, cultural_note = ? WHERE id = ? AND type = 'grammar'`, [g.en, g.note, g.id]);
  }

  // B-05: Back-fill register column on generated cards using tag patterns (idempotent)
  // Cards that already have an explicit non-neutral register (e.g. handwritten seeds) are left untouched.
  _db.run(`UPDATE cards SET register = 'neutral' WHERE register IS NULL`);
  _db.run(`UPDATE cards SET register = 'literary'
            WHERE source = 'generated'
              AND register = 'neutral'
              AND (tags LIKE '%"methali"%' OR tags LIKE '%"proverb"%' OR tags LIKE '%"literary"%')`);
  _db.run(`UPDATE cards SET register = 'slang'
            WHERE source = 'generated'
              AND register = 'neutral'
              AND (tags LIKE '%"sheng"%' OR tags LIKE '%"slang"%')`);
  _db.run(`UPDATE cards SET register = 'informal'
            WHERE source = 'generated'
              AND register = 'neutral'
              AND (tags LIKE '%"informal"%' OR tags LIKE '%"casual"%' OR tags LIKE '%"colloquial"%')`);
  _db.run(`UPDATE cards SET register = 'formal'
            WHERE source = 'generated'
              AND register = 'neutral'
              AND (tags LIKE '%"formal"%' OR tags LIKE '%"polite"%' OR tags LIKE '%"honorific"%'
                OR tags LIKE '%"business"%' OR tags LIKE '%"official"%' OR tags LIKE '%"academic"%')`);

  // Content fix: remove stray double-quotes from english field (e.g. 'plural of "child"' → 'plural of child')
  _db.run(`UPDATE cards SET english = REPLACE(english, '"', '') WHERE english LIKE '%"%'`);

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

  // Back-fill pronunciation for existing users whose DB pre-dates the syllabifier.
  // Only touches single-word cards that are still empty — safe to run every open.
  const missingPron = _db.exec(
    `SELECT DISTINCT swahili FROM cards
     WHERE  swahili NOT LIKE '% %'
     AND    type IN ('vocabulary', 'conjugation')
     AND    (pronunciation IS NULL OR pronunciation = '')`
  );
  if (missingPron.length && missingPron[0].values.length > 0) {
    for (const [word] of missingPron[0].values) {
      _db.run(
        `UPDATE cards SET pronunciation = ?
         WHERE  swahili = ? AND type IN ('vocabulary', 'conjugation')
         AND    (pronunciation IS NULL OR pronunciation = '')`,
        [syllabify(word as string), word],
      );
    }
  }

  // E-01: Reform conjugation English from [tense] bracket notation to natural tense forms
  // Idempotent: only touches cards still carrying the old bracket pattern
  {
    const conjRows = _db.exec(
      "SELECT id, english FROM cards WHERE type='conjugation' AND english LIKE '%[%]%'"
    );
    if (conjRows.length && conjRows[0].values.length) {
      _db.run('BEGIN');
      for (const [id, en] of conjRows[0].values as [string, string][]) {
        const newEn = _ciTransform(en as string);
        if (newEn && newEn !== en) _db.run('UPDATE cards SET english = ? WHERE id = ?', [newEn, id]);
      }
      _db.run('COMMIT');
    }
  }

  // E-02: Reform "plural of X" English labels
  // 2C: hardcoded homonym pairs where the plural Swahili form is also a different word
  // 2A/2B: auto-pluralize base noun; append "(pl)" for English-invariant nouns (fish→fish)
  {
    const _E02_HOMONYMS: Record<string, { english: string; plNote: string; singNote: string }> = {
      nyuma: {
        english: 'forks (pl. of uma)',
        plNote: 'The plural of "uma" (fork) is "nyuma" — the same word as "behind / back". Context makes the meaning clear.',
        singNote: '"Nyuma" is also the plural of "uma" (fork). Context makes the meaning clear.',
      },
      maziwa: {
        english: 'lakes (pl. of ziwa)',
        plNote: '"Maziwa" means both "milk" and "lakes" (the plural of "ziwa"). Context makes the meaning clear.',
        singNote: '"Maziwa" also means "lakes", the plural of "ziwa" (lake). Context makes the meaning clear.',
      },
      mambo: {
        english: 'things / affairs (pl. of jambo)',
        plNote: '"Mambo" is the plural of "jambo" (thing/affair). It is also a casual youth greeting: "Mambo?" = "What\'s up?" — reply "poa" (cool).',
        singNote: '',
      },
      machungwa: {
        english: 'oranges (pl. of chungwa)',
        plNote: '"Machungwa" are oranges. The colour orange in Swahili is "rangi ya machungwa" — literally "the colour of oranges".',
        singNote: '',
      },
    };
    const pluralRows = _db.exec(
      "SELECT id, english, swahili FROM cards WHERE english LIKE 'plural of%'"
    );
    if (pluralRows.length && pluralRows[0].values.length) {
      _db.run('BEGIN');
      for (const [id, en, sw] of pluralRows[0].values as [string, string, string][]) {
        const swLow = (sw as string).toLowerCase();
        if (_E02_HOMONYMS[swLow]) {
          const h = _E02_HOMONYMS[swLow];
          _db.run('UPDATE cards SET english = ?, cultural_note = ? WHERE id = ?', [h.english, h.plNote, id]);
          if (h.singNote) {
            _db.run(
              `UPDATE cards SET cultural_note = ? WHERE swahili = ? AND english NOT LIKE 'plural of%' AND (cultural_note IS NULL OR cultural_note = '')`,
              [h.singNote, sw],
            );
          }
          continue;
        }
        const base = (en as string).replace(/^plural of\s+/i, '').trim();
        const pluralized = _pluralizeBase(base);
        const newEn = pluralized.toLowerCase() === base.toLowerCase() ? `${base} (pl)` : pluralized;
        if (newEn !== en) _db.run('UPDATE cards SET english = ? WHERE id = ?', [newEn, id]);
      }
      _db.run('COMMIT');
    }
  }

  // E-03: Simplify "-zuri" adjective English — "good/beautiful X" → "good X" + cultural note
  // Idempotent: REPLACE on english is always safe; cultural_note only set where absent
  {
    const zuriNote = '-zuri is one of Swahili\'s most versatile adjectives — it covers beautiful, good, nice, fine, and well depending on context.';
    _db.run(
      `UPDATE cards
         SET english       = REPLACE(english, 'good/beautiful', 'good'),
             cultural_note = ?
       WHERE english LIKE '%good/beautiful%'
         AND (cultural_note IS NULL OR cultural_note = '')`,
      [zuriNote],
    );
  }

  // E-04: Populate cultural notes for culturally rich vocabulary words
  // Idempotent: only sets NULL/empty rows; conjugation cards excluded
  // F-01: Separate grammar units into their own independent track
  // Idempotent: track updates are fixed-value; prereq updates are fixed-value
  try { _db.run("ALTER TABLE units ADD COLUMN track TEXT NOT NULL DEFAULT 'vocabulary'"); } catch { /* already exists */ }

  // Mark the 10 grammar-concept units plus the morphology rules unit
  for (const id of ['unit-00-grammar','unit-07','unit-08','unit-09','unit-10','unit-11','unit-14','unit-15','unit-16','unit-17','unit-19']) {
    _db.run("UPDATE units SET track = 'grammar' WHERE id = ?", [id]);
  }

  // Grammar chain — internal prerequisites only (no cross-track deps)
  for (const [id, prereqs] of [
    ['unit-00-grammar', []],
    ['unit-07',  []],
    ['unit-08',  ['unit-07']],
    ['unit-09',  ['unit-08']],
    ['unit-10',  ['unit-07']],
    ['unit-11',  ['unit-08']],
    ['unit-14',  ['unit-09']],
    ['unit-15',  ['unit-10', 'unit-08']],
    ['unit-16',  ['unit-14']],
    ['unit-17',  ['unit-15']],
    ['unit-19',  ['unit-16', 'unit-17']],
  ] as [string, string[]][]) {
    _db.run('UPDATE units SET prerequisite_ids = ? WHERE id = ?', [JSON.stringify(prereqs), id]);
  }

  // Vocabulary track — remove any cross-track dependencies
  // Each entry: [unit_id, new_prerequisite_ids]
  for (const [id, prereqs] of [
    ['unit-12', ['unit-02']],               // was: unit-02, unit-11 (grammar)
    ['unit-13', ['unit-05']],               // was: unit-05, unit-08 (grammar)
    ['unit-18', ['unit-06', 'unit-12']],    // was: unit-09 (grammar), unit-12
    ['unit-20', ['unit-01']],               // was: unit-19 (grammar)
    ['unit-21', ['unit-20']],               // was: unit-19 (grammar), unit-20
    ['unit-23', ['unit-01']],               // was: unit-07 (grammar)
    ['unit-24', ['unit-01']],               // was: unit-08 (grammar)
    ['unit-25', ['unit-01']],               // was: unit-08 (grammar)
    ['unit-26', ['unit-01']],               // was: unit-07, unit-08 (both grammar)
    ['unit-27', ['unit-01']],               // was: unit-01, unit-07 (grammar)
    ['unit-29', ['unit-01']],               // was: unit-08, unit-09 (both grammar)
    ['unit-30', ['unit-01']],               // was: unit-01, unit-07 (grammar)
    ['unit-32', ['unit-03', 'unit-04']],    // was: unit-10, unit-15 (both grammar)
    ['unit-33', ['unit-20', 'unit-32']],    // was: unit-19 (grammar), unit-32
  ] as [string, string[]][]) {
    _db.run('UPDATE units SET prerequisite_ids = ? WHERE id = ?', [JSON.stringify(prereqs), id]);
  }

  // E-04: Populate cultural notes for culturally rich vocabulary words
  // Idempotent: only sets NULL/empty rows; conjugation cards excluded
  for (const [sw, note] of [
    ['shikamoo',   'A respectful greeting offered to elders or those of higher status. Literally related to "grasping the feet"; it is a mark of deep respect with no direct English equivalent.'],
    ['marahaba',   'The reply to "shikamoo". It acknowledges the greeting and signals acceptance of the respect offered.'],
    ['ugali',      'East Africa\'s staple food — a stiff porridge made from maize flour, eaten by hand and used to scoop stews and vegetables. Found on almost every table in Kenya and Tanzania.'],
    ['pilau',      'A fragrant spiced rice dish made with cumin, cardamom, cloves, and cinnamon. A celebration food in coastal Swahili culture, often served at weddings and feasts.'],
    ['chapati',    'An unleavened flatbread of Indian origin, now a beloved staple across East Africa. Made fresh and typically served alongside stews.'],
    ['mandazi',    'East African doughnuts — triangle or oval fried dough, mildly sweet, often flavoured with coconut milk and cardamom. A common breakfast or street snack.'],
    ['chai',       'Tea brewed strong with milk, often spiced with ginger and cardamom. Tea time is a social institution across East Africa — a moment to slow down and connect.'],
    ['habari',     'Literally "news", used as the everyday greeting "How are you?". Common responses: "nzuri" (good), "sawa" (fine), "salama" (peaceful), "njema" (well).'],
    ['mambo',      'Casual greeting popular with youth: "Mambo?" = "What\'s up?" Common responses: "poa" (cool), "safi" (great), "freshi" (fresh). Also the plural of "jambo" (thing/affair).'],
    ['pole',       '"Pole" (POH-leh) expresses sympathy or condolence. "Pole pole" (slowly, slowly) is a beloved phrase reflecting East African patience and philosophy.'],
    ['poa',        'Slang for "cool" or "great". Originally from Nairobi\'s Sheng street language, now widely used across East Africa. Common reply to "mambo?".'],
    ['sawa',       'Means "OK", "fine", "equal", or "agreed". One of the most versatile words in everyday Swahili — a single "sawa" can end negotiations.'],
    ['ndege',      '"Ndege" means both bird and airplane. Context usually makes it clear — though locals sometimes joke that both fly.'],
    ['saa',        'Swahili time uses a 6-hour offset from Western time: the day starts at sunrise (6am = saa moja, "hour one"). "Saa tatu" (3 o\'clock) = 9am or 9pm in Western time.'],
  ] as [string, string][]) {
    _db.run(
      `UPDATE cards SET cultural_note = ? WHERE swahili = ? AND type != 'conjugation' AND (cultural_note IS NULL OR cultural_note = '')`,
      [note, sw],
    );
  }
  setMigrationVersion(_db, LEGACY_MIGRATION_VERSION);
  }

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
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  _db?.close();
  _db = null;
  _currentUser = null;
  if (user) await idbDelete(`db_${user}`);
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

type Param = string | number | null | undefined;

function ensureMigrationTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

function getMigrationVersion(db: Database): number {
  const result = db.exec('SELECT version FROM schema_migrations WHERE id = 1');
  return result[0]?.values[0]?.[0] as number ?? 0;
}

function setMigrationVersion(db: Database, version: number): void {
  db.run(
    `INSERT INTO schema_migrations (id, version, applied_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       version = excluded.version,
       applied_at = excluded.applied_at`,
    [version, new Date().toISOString()],
  );
}

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
  run(
    `INSERT INTO card_states
       (card_id, depth_level, stability, difficulty, retrievability,
        last_review, next_review, review_count, lapse_count,
        consecutive_correct, fast_learn_level, fast_learn_fail_count,
        response_time_avg_ms, starred)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
      state.starred ? 1 : 0,
    ],
  );
}

export async function setCardStarred(cardId: string, starred: boolean): Promise<void> {
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

export type ReviewFilter = 'quick_learn' | 'unit-01' | 'unit-05' | 'all';

export async function getReviewQueue(filter: ReviewFilter): Promise<Card[]> {
  let where: string;
  if (filter === 'quick_learn') {
    where = `c.quick_learn = 1 AND c.source IN ('generated','reviewed') AND c.type = 'vocabulary'`;
  } else if (filter === 'all') {
    where = `c.source IN ('generated','reviewed') AND c.type IN ('vocabulary','phrase')`;
  } else {
    where = `c.unit_id = '${filter}' AND c.source IN ('generated','reviewed')`;
  }
  return query<Record<string, unknown>>(
    `SELECT * FROM cards c
     WHERE ${where}
     ORDER BY CASE c.source WHEN 'generated' THEN 0 ELSE 1 END ASC, c.frequency_rank ASC`,
  ).map(parseCard);
}

export interface ReviewUpdate {
  english:      string;
  pronunciation: string;
  register:     string;
  cultural_note: string;
}

export async function saveReviewedCard(id: string, updates: ReviewUpdate): Promise<void> {
  run(
    `UPDATE cards SET
       english = ?, pronunciation = ?, register = ?, cultural_note = ?, source = 'reviewed'
     WHERE id = ?`,
    [updates.english, updates.pronunciation, updates.register, updates.cultural_note || null, id],
  );
}

export async function getReviewStats(): Promise<{ reviewed: number; generated: number }> {
  const rows = query<{ source: string; cnt: number }>(
    `SELECT source, COUNT(*) as cnt FROM cards
     WHERE source IN ('generated','reviewed') AND type IN ('vocabulary','phrase')
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
