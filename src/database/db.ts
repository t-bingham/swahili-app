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

  // A-01: card metadata columns
  try { _db.run("ALTER TABLE cards ADD COLUMN register TEXT DEFAULT 'neutral'"); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN morpheme_breakdown TEXT'); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN part_of_speech TEXT'); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN etymology TEXT'); } catch { /* already exists */ }
  try { _db.run("ALTER TABLE cards ADD COLUMN dialect TEXT DEFAULT 'standard'"); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN cultural_note TEXT'); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN senses TEXT'); } catch { /* already exists */ }
  try { _db.run('ALTER TABLE cards ADD COLUMN placement_only INTEGER DEFAULT 0'); } catch { /* already exists */ }

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

  // B-04: placement test seed data (idempotent — INSERT OR IGNORE)
  _db.run(`INSERT OR IGNORE INTO units
    (id, name, description, level, order_index, prerequisite_ids, grammar_notes, estimated_hours)
    VALUES ('unit-00-placement','Placement Test','Diagnostic cards used to determine your starting level',1,0,'[]','',0)`);

  interface PlacementSeed {
    id: string; sw: string; en: string; pr: string; pos: string;
    senses: Array<{ english: string; pos?: string }>;
    tags: string[]; diff: number; rank: number;
    ex: { swahili: string; english: string };
  }

  const PLACEMENT_SEEDS: PlacementSeed[] = [
    // Tier 1 — absolute basics (ranks 1–10)
    { id:'pl-001', sw:'jambo',     en:'hello',      pr:'JAM-bo',         pos:'interjection', senses:[{english:'hello'},{english:'hi'}], tags:['greetings'], diff:0.2, rank:1,  ex:{swahili:'Jambo, rafiki!', english:'Hello, friend!'} },
    { id:'pl-002', sw:'asante',    en:'thank you',  pr:'a-SAN-te',       pos:'interjection', senses:[{english:'thank you'},{english:'thanks'}], tags:['greetings'], diff:0.2, rank:2,  ex:{swahili:'Asante sana!', english:'Thank you very much!'} },
    { id:'pl-003', sw:'ndiyo',     en:'yes',        pr:'NDI-yo',         pos:'particle',     senses:[{english:'yes'},{english:'correct'}], tags:['basics'], diff:0.2, rank:3,  ex:{swahili:'Ndiyo, ninajua.', english:'Yes, I know.'} },
    { id:'pl-004', sw:'hapana',    en:'no',         pr:'ha-PA-na',       pos:'particle',     senses:[{english:'no'},{english:'not at all'}], tags:['basics'], diff:0.2, rank:4,  ex:{swahili:'Hapana, sijui.', english:'No, I don\'t know.'} },
    { id:'pl-005', sw:'maji',      en:'water',      pr:'MA-ji',          pos:'noun',         senses:[{english:'water'}], tags:['food','nouns'], diff:0.2, rank:5,  ex:{swahili:'Ninataka maji.', english:'I want water.'} },
    { id:'pl-006', sw:'chakula',   en:'food',       pr:'cha-KU-la',      pos:'noun',         senses:[{english:'food'},{english:'meal'}], tags:['food','nouns'], diff:0.25, rank:6,  ex:{swahili:'Chakula kizuri.', english:'Good food.'} },
    { id:'pl-007', sw:'mzuri',     en:'good',       pr:'m-ZU-ri',        pos:'adjective',    senses:[{english:'good'},{english:'fine'},{english:'nice'},{english:'well'}], tags:['adjectives','basics'], diff:0.25, rank:7,  ex:{swahili:'Niko mzuri.', english:'I am fine.'} },
    { id:'pl-008', sw:'sawa',      en:'okay',       pr:'SA-wa',          pos:'adjective',    senses:[{english:'okay'},{english:'alright'},{english:'fine'},{english:'equal'}], tags:['basics'], diff:0.25, rank:8,  ex:{swahili:'Sawa, tutaenda.', english:'Okay, we will go.'} },
    { id:'pl-009', sw:'karibu',    en:'welcome',    pr:'ka-RI-bu',       pos:'interjection', senses:[{english:'welcome'},{english:'come in'},{english:'you\'re welcome'},{english:'near'}], tags:['greetings'], diff:0.25, rank:9,  ex:{swahili:'Karibu nyumbani!', english:'Welcome home!'} },
    { id:'pl-010', sw:'tafadhali', en:'please',     pr:'ta-fa-DHA-li',   pos:'adverb',       senses:[{english:'please'},{english:'kindly'}], tags:['greetings','basics'], diff:0.3, rank:10, ex:{swahili:'Tafadhali nisaidie.', english:'Please help me.'} },
    // Tier 2 — basic nouns (ranks 11–20)
    { id:'pl-011', sw:'nyumba',    en:'house',      pr:'NYUM-ba',        pos:'noun',         senses:[{english:'house'},{english:'home'},{english:'building'}], tags:['housing','nouns'], diff:0.3, rank:11, ex:{swahili:'Nyumba yangu ni kubwa.', english:'My house is big.'} },
    { id:'pl-012', sw:'mtu',       en:'person',     pr:'M-tu',           pos:'noun',         senses:[{english:'person'},{english:'man'},{english:'human'}], tags:['people','nouns'], diff:0.3, rank:12, ex:{swahili:'Mtu huyu ni mzuri.', english:'This person is good.'} },
    { id:'pl-013', sw:'jina',      en:'name',       pr:'JI-na',          pos:'noun',         senses:[{english:'name'}], tags:['basics','nouns'], diff:0.3, rank:13, ex:{swahili:'Jina lako ni nani?', english:'What is your name?'} },
    { id:'pl-014', sw:'mwalimu',   en:'teacher',    pr:'mwa-LI-mu',      pos:'noun',         senses:[{english:'teacher'},{english:'instructor'}], tags:['professions','nouns'], diff:0.3, rank:14, ex:{swahili:'Mwalimu wangu ni mzuri.', english:'My teacher is good.'} },
    { id:'pl-015', sw:'mama',      en:'mother',     pr:'MA-ma',          pos:'noun',         senses:[{english:'mother'},{english:'mom'}], tags:['family','nouns'], diff:0.3, rank:15, ex:{swahili:'Mama yangu anafanya kazi.', english:'My mother works.'} },
    { id:'pl-016', sw:'baba',      en:'father',     pr:'BA-ba',          pos:'noun',         senses:[{english:'father'},{english:'dad'}], tags:['family','nouns'], diff:0.3, rank:16, ex:{swahili:'Baba yangu ni mwalimu.', english:'My father is a teacher.'} },
    { id:'pl-017', sw:'mtoto',     en:'child',      pr:'m-TO-to',        pos:'noun',         senses:[{english:'child'},{english:'baby'},{english:'kid'}], tags:['family','nouns'], diff:0.3, rank:17, ex:{swahili:'Mtoto anacheza.', english:'The child is playing.'} },
    { id:'pl-018', sw:'siku',      en:'day',        pr:'SI-ku',          pos:'noun',         senses:[{english:'day'}], tags:['time','nouns'], diff:0.35, rank:18, ex:{swahili:'Siku ya leo ni nzuri.', english:'Today is a nice day.'} },
    { id:'pl-019', sw:'mji',       en:'town',       pr:'M-ji',           pos:'noun',         senses:[{english:'town'},{english:'city'}], tags:['places','nouns'], diff:0.35, rank:19, ex:{swahili:'Ninaishi mjini.', english:'I live in town.'} },
    { id:'pl-020', sw:'nchi',      en:'country',    pr:'N-chi',          pos:'noun',         senses:[{english:'country'},{english:'land'},{english:'nation'}], tags:['places','nouns'], diff:0.35, rank:20, ex:{swahili:'Nchi yangu ni Tanzania.', english:'My country is Tanzania.'} },
    // Tier 3 — basic infinitives (ranks 21–30)
    { id:'pl-021', sw:'kwenda',    en:'to go',      pr:'KWEN-da',        pos:'verb',         senses:[{english:'to go'},{english:'to travel'}], tags:['verbs','movement'], diff:0.35, rank:21, ex:{swahili:'Ninataka kwenda Nairobi.', english:'I want to go to Nairobi.'} },
    { id:'pl-022', sw:'kuja',      en:'to come',    pr:'KU-ja',          pos:'verb',         senses:[{english:'to come'},{english:'to arrive'}], tags:['verbs','movement'], diff:0.35, rank:22, ex:{swahili:'Tafadhali kuja hapa.', english:'Please come here.'} },
    { id:'pl-023', sw:'kula',      en:'to eat',     pr:'KU-la',          pos:'verb',         senses:[{english:'to eat'}], tags:['verbs','food'], diff:0.35, rank:23, ex:{swahili:'Ninapenda kula matunda.', english:'I like to eat fruit.'} },
    { id:'pl-024', sw:'kunywa',    en:'to drink',   pr:'KU-nywa',        pos:'verb',         senses:[{english:'to drink'}], tags:['verbs','food'], diff:0.35, rank:24, ex:{swahili:'Ninakunywa maji.', english:'I am drinking water.'} },
    { id:'pl-025', sw:'kulala',    en:'to sleep',   pr:'ku-LA-la',       pos:'verb',         senses:[{english:'to sleep'},{english:'to lie down'}], tags:['verbs','daily-life'], diff:0.4, rank:25, ex:{swahili:'Ninataka kulala.', english:'I want to sleep.'} },
    { id:'pl-026', sw:'kufanya',   en:'to do',      pr:'ku-FA-nya',      pos:'verb',         senses:[{english:'to do'},{english:'to make'}], tags:['verbs'], diff:0.4, rank:26, ex:{swahili:'Unafanya nini?', english:'What are you doing?'} },
    { id:'pl-027', sw:'kusema',    en:'to speak',   pr:'ku-SE-ma',       pos:'verb',         senses:[{english:'to speak'},{english:'to say'},{english:'to talk'}], tags:['verbs','communication'], diff:0.4, rank:27, ex:{swahili:'Ninasema Kiswahili.', english:'I speak Swahili.'} },
    { id:'pl-028', sw:'kuona',     en:'to see',     pr:'ku-O-na',        pos:'verb',         senses:[{english:'to see'},{english:'to look'},{english:'to find'}], tags:['verbs'], diff:0.4, rank:28, ex:{swahili:'Ninaona nyumba kubwa.', english:'I see a big house.'} },
    { id:'pl-029', sw:'kujua',     en:'to know',    pr:'ku-JU-a',        pos:'verb',         senses:[{english:'to know'}], tags:['verbs'], diff:0.4, rank:29, ex:{swahili:'Sijui Kiswahili vizuri.', english:'I don\'t know Swahili well.'} },
    { id:'pl-030', sw:'kupenda',   en:'to love',    pr:'ku-PEN-da',      pos:'verb',         senses:[{english:'to love'},{english:'to like'},{english:'to want'}], tags:['verbs','emotions'], diff:0.4, rank:30, ex:{swahili:'Ninapenda muziki.', english:'I love music.'} },
    // Tier 4 — basic conjugations & high-frequency vocabulary (ranks 31–40)
    { id:'pl-031', sw:'ninapenda', en:'I love',     pr:'ni-na-PEN-da',   pos:'verb',         senses:[{english:'I love'},{english:'I like'}], tags:['conjugation','emotions','present-tense'], diff:0.45, rank:31, ex:{swahili:'Ninapenda kahawa.', english:'I love coffee.'} },
    { id:'pl-032', sw:'ninakwenda',en:'I am going', pr:'ni-na-KWEN-da',  pos:'verb',         senses:[{english:'I am going'},{english:'I go'}], tags:['conjugation','movement','present-tense'], diff:0.45, rank:32, ex:{swahili:'Ninakwenda shuleni.', english:'I am going to school.'} },
    { id:'pl-033', sw:'sijui',     en:"I don't know", pr:'si-JU-i',      pos:'phrase',       senses:[{english:"I don't know"},{english:'I do not know'}], tags:['phrases','negation'], diff:0.45, rank:33, ex:{swahili:'Sijui jibu.', english:"I don't know the answer."} },
    { id:'pl-034', sw:'haraka',    en:'quickly',    pr:'ha-RA-ka',       pos:'adverb',       senses:[{english:'quickly'},{english:'fast'},{english:'hurry'}], tags:['adverbs'], diff:0.45, rank:34, ex:{swahili:'Nenda haraka!', english:'Go quickly!'} },
    { id:'pl-035', sw:'polepole',  en:'slowly',     pr:'po-le-PO-le',    pos:'adverb',       senses:[{english:'slowly'},{english:'carefully'},{english:'take it easy'}], tags:['adverbs'], diff:0.45, rank:35, ex:{swahili:'Nenda polepole.', english:'Go slowly.'} },
    { id:'pl-036', sw:'sasa',      en:'now',        pr:'SA-sa',          pos:'adverb',       senses:[{english:'now'},{english:'right now'},{english:'currently'}], tags:['time','adverbs'], diff:0.45, rank:36, ex:{swahili:'Nifanye nini sasa?', english:'What should I do now?'} },
    { id:'pl-037', sw:'kesho',     en:'tomorrow',   pr:'KE-sho',         pos:'adverb',       senses:[{english:'tomorrow'},{english:'the next day'}], tags:['time','adverbs'], diff:0.5, rank:37, ex:{swahili:'Tutaonana kesho.', english:'We will meet tomorrow.'} },
    { id:'pl-038', sw:'jana',      en:'yesterday',  pr:'JA-na',          pos:'adverb',       senses:[{english:'yesterday'}], tags:['time','adverbs'], diff:0.5, rank:38, ex:{swahili:'Jana nilikwenda sokoni.', english:'Yesterday I went to the market.'} },
    { id:'pl-039', sw:'leo',       en:'today',      pr:'LE-o',           pos:'adverb',       senses:[{english:'today'}], tags:['time','adverbs'], diff:0.5, rank:39, ex:{swahili:'Leo ni siku nzuri.', english:'Today is a nice day.'} },
    { id:'pl-040', sw:'jioni',     en:'evening',    pr:'ji-O-ni',        pos:'noun',         senses:[{english:'evening'},{english:'late afternoon'}], tags:['time','nouns'], diff:0.5, rank:40, ex:{swahili:'Jioni tunakula pamoja.', english:'In the evening we eat together.'} },
    // Tier 5 — upper intermediate (ranks 41–50)
    { id:'pl-041', sw:'nilikwenda',  en:'I went',        pr:'ni-li-KWEN-da',  pos:'verb', senses:[{english:'I went'},{english:'I traveled'}], tags:['conjugation','movement','past-tense'], diff:0.55, rank:41, ex:{swahili:'Nilikwenda Mombasa wiki iliyopita.', english:'I went to Mombasa last week.'} },
    { id:'pl-042', sw:'nitakwenda',  en:'I will go',     pr:'ni-ta-KWEN-da',  pos:'verb', senses:[{english:'I will go'},{english:'I am going to go'}], tags:['conjugation','movement','future-tense'], diff:0.55, rank:42, ex:{swahili:'Nitakwenda kesho asubuhi.', english:'I will go tomorrow morning.'} },
    { id:'pl-043', sw:'amefanya',    en:'he has done',   pr:'a-me-FA-nya',    pos:'verb', senses:[{english:'he has done'},{english:'she has done'},{english:'has done'}], tags:['conjugation','perfect-tense'], diff:0.6, rank:43, ex:{swahili:'Amefanya kazi nzuri.', english:'He has done good work.'} },
    { id:'pl-044', sw:'ningependa',  en:'I would like',  pr:'nin-ge-PEN-da',  pos:'verb', senses:[{english:'I would like'},{english:'I would love'},{english:'I would want'}], tags:['conjugation','conditional'], diff:0.6, rank:44, ex:{swahili:'Ningependa kahawa, tafadhali.', english:'I would like coffee, please.'} },
    { id:'pl-045', sw:'wakati',      en:'time',          pr:'wa-KA-ti',       pos:'noun', senses:[{english:'time'},{english:'when'},{english:'period'},{english:'moment'}], tags:['time','nouns'], diff:0.6, rank:45, ex:{swahili:'Wakati ni muhimu.', english:'Time is important.'} },
    { id:'pl-046', sw:'ingawa',      en:'although',      pr:'in-GA-wa',       pos:'conjunction', senses:[{english:'although'},{english:'even though'},{english:'despite'}], tags:['conjunctions'], diff:0.65, rank:46, ex:{swahili:'Ingawa ninachoka, nitaendelea.', english:'Although I am tired, I will continue.'} },
    { id:'pl-047', sw:'lakini',      en:'but',           pr:'la-KI-ni',       pos:'conjunction', senses:[{english:'but'},{english:'however'},{english:'yet'}], tags:['conjunctions'], diff:0.65, rank:47, ex:{swahili:'Nataka kula, lakini sijala bado.', english:'I want to eat, but I haven\'t eaten yet.'} },
    { id:'pl-048', sw:'kwa sababu',  en:'because',       pr:'kwa sa-BA-bu',   pos:'conjunction', senses:[{english:'because'},{english:'since'},{english:'for'}], tags:['conjunctions'], diff:0.65, rank:48, ex:{swahili:'Ninafurahi kwa sababu umefika.', english:'I am happy because you arrived.'} },
    { id:'pl-049', sw:'pamoja',      en:'together',      pr:'pa-MO-ja',       pos:'adverb',      senses:[{english:'together'},{english:'along with'},{english:'as well'}], tags:['adverbs'], diff:0.65, rank:49, ex:{swahili:'Tutafanya kazi pamoja.', english:'We will work together.'} },
    { id:'pl-050', sw:'badala ya',   en:'instead of',    pr:'ba-DA-la ya',    pos:'phrase',      senses:[{english:'instead of'},{english:'in place of'},{english:'rather than'}], tags:['phrases'], diff:0.7, rank:50, ex:{swahili:'Badala ya chai, ninakunywa maji.', english:'Instead of tea, I drink water.'} },
  ];

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

  interface PhraseSeed {
    id: string; sw: string; en: string; pr: string;
    tags: string[]; register: string;
    senses: Array<{ english: string }>;
    note?: string;
    ex: { swahili: string; english: string };
  }

  const PHRASE_SEEDS: PhraseSeed[] = [
    // ── Extended greetings ──────────────────────────────────────────────────
    { id:'phr-001', sw:'Habari za asubuhi?',       en:'Good morning?',                pr:'ha-BA-ri za a-su-BU-hi',         tags:['phrases','greetings'], register:'neutral',  senses:[{english:'Good morning?'},{english:'How are things this morning?'}], note:'Literally "News of the morning?" Reply: "Nzuri" or "Nzuri sana, asante".', ex:{swahili:'Habari za asubuhi? — Nzuri sana!', english:'Good morning? — Very well!'} },
    { id:'phr-002', sw:'Habari za jioni?',          en:'Good evening?',                pr:'ha-BA-ri za ji-O-ni',             tags:['phrases','greetings'], register:'neutral',  senses:[{english:'Good evening?'},{english:'How are things this evening?'}], ex:{swahili:'Habari za jioni, mama.', english:"Good evening, ma'am."} },
    { id:'phr-003', sw:'Habari yako?',              en:'How are you?',                 pr:'ha-BA-ri YA-ko',                 tags:['phrases','greetings'], register:'neutral',  senses:[{english:'How are you?'},{english:'How are things with you?'}], note:'Singular "you". Reply: "Nzuri" or "Sijambo".', ex:{swahili:'Habari yako? Habari za kazi?', english:"How are you? How's work?"} },
    { id:'phr-004', sw:'Hujambo?',                 en:'How are you?',                 pr:'hu-JAM-bo',                      tags:['phrases','greetings'], register:'neutral',  senses:[{english:'How are you?'},{english:'Are you well?'}], note:'Literally "You have no problems?" Standard greeting for one person.', ex:{swahili:'Hujambo, rafiki yangu?', english:'How are you, my friend?'} },
    { id:'phr-005', sw:'Sijambo',                  en:"I'm fine",                     pr:'si-JAM-bo',                      tags:['phrases','greetings'], register:'neutral',  senses:[{english:"I'm fine"},{english:'I have no problems'},{english:"I'm well"}], note:'Standard reply to "Hujambo?". Literally "I have no problems."', ex:{swahili:'Sijambo, asante. Na wewe?', english:"I'm fine, thank you. And you?"} },
    { id:'phr-006', sw:'Hamjambo?',                en:'How are you all?',             pr:'ham-JAM-bo',                     tags:['phrases','greetings'], register:'neutral',  senses:[{english:'How are you all?'},{english:'How are you? (plural)'}], note:'Plural form of Hujambo — use when greeting more than one person.', ex:{swahili:'Hamjambo, watu wote!', english:'How are you all, everyone!'} },
    { id:'phr-007', sw:'Hatujambo',                en:"We're all fine",               pr:'ha-tu-JAM-bo',                   tags:['phrases','greetings'], register:'neutral',  senses:[{english:"We're fine"},{english:'We are all well'}], ex:{swahili:'Hatujambo, asante sana.', english:"We're all fine, thank you very much."} },
    { id:'phr-008', sw:'Shikamoo',                 en:'Respectful greeting to elders', pr:'shi-ka-MO-o',                   tags:['phrases','greetings','formal'], register:'formal', senses:[{english:'Respectful greeting'},{english:'I hold your feet'}], note:'Used by younger people greeting elders. Essential in formal and traditional contexts. The elder replies "Marahaba".', ex:{swahili:'Shikamoo, bibi.', english:'Respectful greetings, grandmother.'} },
    { id:'phr-009', sw:'Marahaba',                 en:'Response to shikamoo',         pr:'ma-ra-HA-ba',                    tags:['phrases','greetings','formal'], register:'formal', senses:[{english:'Thank you for the respect'},{english:'I accept your greeting'}], note:"The elder's response to Shikamoo. Only said by the elder being greeted.", ex:{swahili:'Shikamoo. — Marahaba, mtoto.', english:'Respectful greetings. — Thank you, child.'} },
    { id:'phr-010', sw:'Karibu tena',              en:'Welcome again',                pr:'ka-RI-bu TE-na',                 tags:['phrases','greetings'], register:'neutral',  senses:[{english:'Welcome again'},{english:'Come again'},{english:"You're welcome back"}], ex:{swahili:'Karibu tena dukani kwetu!', english:'Welcome back to our shop!'} },
    { id:'phr-011', sw:'Habari ya kazi?',          en:"How's work?",                  pr:'ha-BA-ri ya KA-zi',              tags:['phrases','greetings'], register:'neutral',  senses:[{english:"How's work?"},{english:'How are things at work?'}], ex:{swahili:'Habari yako? — Nzuri. Habari ya kazi?', english:"How are you? — Fine. How's work?"} },

    // ── Farewells ───────────────────────────────────────────────────────────
    { id:'phr-012', sw:'Kwaheri ya kuonana',       en:'Goodbye until we meet again',  pr:'kwa-HE-ri ya ku-o-NA-na',        tags:['phrases','farewells'], register:'neutral',  senses:[{english:'Goodbye until we meet again'},{english:'Farewell till we see each other'}], note:'More heartfelt than plain "Kwaheri" — implies you look forward to meeting again.', ex:{swahili:'Kwaheri ya kuonana, safari njema!', english:'Goodbye until we meet again, safe travels!'} },
    { id:'phr-013', sw:'Tutaonana',                en:"We'll meet again",             pr:'tu-ta-o-NA-na',                  tags:['phrases','farewells'], register:'neutral',  senses:[{english:"We'll meet again"},{english:'See you'},{english:"I'll see you"}], ex:{swahili:'Tutaonana kesho asubuhi.', english:"We'll see each other tomorrow morning."} },
    { id:'phr-014', sw:'Lala salama',              en:'Good night',                   pr:'LA-la sa-LA-ma',                 tags:['phrases','farewells'], register:'neutral',  senses:[{english:'Good night'},{english:'Sleep well'},{english:'Sleep peacefully'}], note:'Literally "Sleep in peace/safety". Warmer than "Usiku mwema".', ex:{swahili:'Lala salama, mtoto wangu.', english:'Good night, my child.'} },
    { id:'phr-015', sw:'Usiku mwema',              en:'Good night',                   pr:'u-SI-ku MWE-ma',                 tags:['phrases','farewells'], register:'neutral',  senses:[{english:'Good night'},{english:'Good evening'}], ex:{swahili:'Usiku mwema, tutaonana kesho.', english:'Good night, see you tomorrow.'} },
    { id:'phr-016', sw:'Safari njema',             en:'Safe travels',                 pr:'sa-FA-ri NJE-ma',                tags:['phrases','farewells'], register:'neutral',  senses:[{english:'Safe travels'},{english:'Have a good journey'},{english:'Bon voyage'}], note:'Said to someone who is travelling. A warm and common farewell.', ex:{swahili:'Safari njema! Uwasiliane natuoni ukifika.', english:'Safe travels! Let us know when you arrive.'} },
    { id:'phr-017', sw:'Baadaye',                  en:'Later',                        pr:'ba-a-DA-ye',                     tags:['phrases','farewells'], register:'neutral',  senses:[{english:'Later'},{english:'See you later'},{english:'Goodbye for now'}], ex:{swahili:'Ninahangaika sasa — baadaye!', english:"I'm busy now — later!"} },
    { id:'phr-018', sw:'Tutaonana baadaye',        en:'See you later',                pr:'tu-ta-o-NA-na ba-a-DA-ye',       tags:['phrases','farewells'], register:'neutral',  senses:[{english:'See you later'},{english:"We'll meet later"}], ex:{swahili:'Lazima niende sasa — tutaonana baadaye.', english:"I have to go now — see you later."} },

    // ── Politeness ──────────────────────────────────────────────────────────
    { id:'phr-019', sw:'Samahani',                 en:'Excuse me',                    pr:'sa-ma-HA-ni',                    tags:['phrases','politeness'], register:'neutral', senses:[{english:'Excuse me'},{english:"I'm sorry"},{english:'Pardon me'},{english:'Forgive me'}], note:'Used both to get attention and to apologise. Very versatile.', ex:{swahili:'Samahani, unajua hoteli iko wapi?', english:'Excuse me, do you know where the hotel is?'} },
    { id:'phr-020', sw:'Pole sana',                en:"I'm very sorry",               pr:'PO-le SA-na',                    tags:['phrases','politeness'], register:'neutral', senses:[{english:"I'm very sorry"},{english:'So sorry'},{english:'My condolences'}], note:"Expresses sympathy for someone's misfortune or loss — not just a generic apology. Very important culturally.", ex:{swahili:'Pole sana kwa habari hiyo mbaya.', english:"I'm so sorry to hear that bad news."} },
    { id:'phr-021', sw:'Asante sana',              en:'Thank you very much',           pr:'a-SAN-te SA-na',                 tags:['phrases','politeness'], register:'neutral', senses:[{english:'Thank you very much'},{english:'Thanks a lot'},{english:'Many thanks'}], ex:{swahili:'Asante sana kwa msaada wako!', english:'Thank you very much for your help!'} },
    { id:'phr-022', sw:'Karibu sana',              en:"You're very welcome",           pr:'ka-RI-bu SA-na',                 tags:['phrases','politeness'], register:'neutral', senses:[{english:"You're very welcome"},{english:"Don't mention it"},{english:'My pleasure'}], ex:{swahili:'Asante. — Karibu sana!', english:"Thank you. — You're very welcome!"} },
    { id:'phr-023', sw:'Unaweza kunisaidia?',      en:'Can you help me?',             pr:'u-na-WE-za ku-ni-sa-i-DI-a',     tags:['phrases','requests'],   register:'neutral', senses:[{english:'Can you help me?'},{english:'Would you be able to help me?'}], ex:{swahili:'Unaweza kunisaidia kupata gari?', english:'Can you help me get a car?'} },
    { id:'phr-024', sw:'Tafadhali nisaidie',       en:'Please help me',               pr:'ta-fa-DHA-li ni-sa-i-DI-e',      tags:['phrases','requests'],   register:'neutral', senses:[{english:'Please help me'},{english:'Help me please'}], ex:{swahili:'Tafadhali nisaidie kubeba mzigo huu.', english:'Please help me carry this luggage.'} },

    // ── Understanding & communication ────────────────────────────────────────
    { id:'phr-025', sw:'Naelewa',                  en:'I understand',                 pr:'na-e-LE-wa',                     tags:['phrases','communication'], register:'neutral', senses:[{english:'I understand'},{english:'I see'},{english:'I get it'}], ex:{swahili:'Naelewa, asante kwa maelezo.', english:'I understand, thank you for the explanation.'} },
    { id:'phr-026', sw:'Sijaelewa',                en:"I don't understand",           pr:'si-ja-e-LE-wa',                  tags:['phrases','communication'], register:'neutral', senses:[{english:"I don't understand"},{english:"I haven't understood"},{english:"I'm not following"}], ex:{swahili:"Sijaelewa vizuri — unaweza kusema tena?", english:"I don't quite understand — can you say it again?"} },
    { id:'phr-027', sw:'Tena tafadhali',           en:'Again please',                 pr:'TE-na ta-fa-DHA-li',             tags:['phrases','communication'], register:'neutral', senses:[{english:'Again please'},{english:'Could you repeat that?'},{english:'Say it again please'}], ex:{swahili:'Tena tafadhali, polepole zaidi.', english:'Again please, more slowly.'} },
    { id:'phr-028', sw:'Polepole zaidi',           en:'More slowly please',           pr:'po-le-PO-le ZA-i-di',            tags:['phrases','communication'], register:'neutral', senses:[{english:'More slowly'},{english:'Slower please'},{english:'Take it a bit slower'}], ex:{swahili:'Unaweza kusema polepole zaidi?', english:'Can you speak more slowly?'} },
    { id:'phr-029', sw:'Unamaanisha nini?',        en:'What do you mean?',            pr:'u-na-ma-a-NI-sha NI-ni',         tags:['phrases','communication'], register:'neutral', senses:[{english:'What do you mean?'},{english:'What are you saying?'}], ex:{swahili:'Unamaanisha nini kwa "baadaye"?', english:'What do you mean by "later"?'} },
    { id:'phr-030', sw:'Ninasema Kiswahili kidogo',en:'I speak a little Swahili',      pr:'ni-na-SE-ma ki-swa-HI-li ki-DO-go', tags:['phrases','communication'], register:'neutral', senses:[{english:'I speak a little Swahili'},{english:'My Swahili is limited'}], ex:{swahili:'Ninasema Kiswahili kidogo — pole!', english:"I speak a little Swahili — sorry!"} },
    { id:'phr-031', sw:'Ninajaribu kujifunza',     en:'I am trying to learn',         pr:'ni-na-ja-RI-bu ku-ji-FU-nza',    tags:['phrases','communication'], register:'neutral', senses:[{english:'I am trying to learn'},{english:"I'm studying"}], note:'Saying this usually earns encouragement and patience from native speakers.', ex:{swahili:'Ninajaribu kujifunza Kiswahili.', english:'I am trying to learn Swahili.'} },

    // ── Practical questions ──────────────────────────────────────────────────
    { id:'phr-032', sw:'Ni saa ngapi?',            en:'What time is it?',             pr:'ni sa-a NGA-pi',                 tags:['phrases','time'],       register:'neutral', senses:[{english:'What time is it?'},{english:'What hour is it?'}], note:'Swahili clock (saa) starts at 6am = saa moja (hour one). Add 6 hours to convert to Western time.', ex:{swahili:'Samahani, ni saa ngapi sasa?', english:'Excuse me, what time is it now?'} },
    { id:'phr-033', sw:'Hii ni nini?',             en:'What is this?',                pr:'HI-i ni NI-ni',                  tags:['phrases','questions'],   register:'neutral', senses:[{english:'What is this?'},{english:'What is it?'}], ex:{swahili:'Hii ni nini? Sijawahi kuona.', english:"What is this? I've never seen it before."} },
    { id:'phr-034', sw:'Ni bei gani?',             en:"What's the price?",            pr:'ni BE-i GA-ni',                  tags:['phrases','shopping'],    register:'neutral', senses:[{english:"What's the price?"},{english:'How much does it cost?'},{english:'How much?'}], ex:{swahili:'Embe hizi ni bei gani?', english:"What's the price of these mangoes?"} },
    { id:'phr-035', sw:'Naweza kukaa hapa?',       en:'Can I sit here?',              pr:'na-WE-za ku-KA-a HA-pa',         tags:['phrases','questions'],   register:'neutral', senses:[{english:'Can I sit here?'},{english:'May I sit here?'},{english:'Is this seat taken?'}], ex:{swahili:'Samahani, naweza kukaa hapa?', english:'Excuse me, can I sit here?'} },
    { id:'phr-036', sw:'Naweza kupita?',           en:'Can I pass?',                  pr:'na-WE-za ku-PI-ta',              tags:['phrases','questions'],   register:'neutral', senses:[{english:'Can I pass?'},{english:'May I come through?'},{english:'Excuse me, coming through'}], ex:{swahili:'Naweza kupita, tafadhali?', english:'Can I pass through, please?'} },
    { id:'phr-037', sw:'Uko wapi?',                en:'Where are you?',               pr:'U-ko WA-pi',                     tags:['phrases','questions'],   register:'neutral', senses:[{english:'Where are you?'},{english:'Where are you located?'}], ex:{swahili:'Uko wapi? Nimekungoja kwa muda.', english:"Where are you? I've been waiting for you for a while."} },

    // ── Daily expressions ────────────────────────────────────────────────────
    { id:'phr-038', sw:'Niko tayari',              en:'I am ready',                   pr:'NI-ko ta-YA-ri',                 tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'I am ready'},{english:"I'm all set"},{english:'Ready to go'}], ex:{swahili:'Niko tayari — twende!', english:"I'm ready — let's go!"} },
    { id:'phr-039', sw:'Bado',                     en:'Not yet',                      pr:'BA-do',                          tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'Not yet'},{english:'Still'},{english:'Not done yet'}], ex:{swahili:'Umekwisha kula? — Bado.', english:'Have you eaten yet? — Not yet.'} },
    { id:'phr-040', sw:'Sawa sawa',                en:"It's fine",                    pr:'SA-wa SA-wa',                    tags:['phrases','daily-life'], register:'informal', senses:[{english:"It's fine"},{english:'Alright alright'},{english:'No problem'}], note:'Informal, slightly casual — more emphatic version of "sawa". Very common in everyday speech.', ex:{swahili:'Pole kwa kuchelewa. — Sawa sawa!', english:"Sorry for being late. — It's totally fine!"} },
    { id:'phr-041', sw:'Hakuna matata',            en:'No worries',                   pr:'ha-KU-na ma-TA-ta',              tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'No worries'},{english:'No problem'},{english:'No trouble'}], note:'Genuine everyday expression widely used across East Africa — not just a film phrase.', ex:{swahili:'Samahani kwa usumbufu. — Hakuna matata!', english:'Sorry for the inconvenience. — No worries!'} },
    { id:'phr-042', sw:'Hakuna shida',             en:'No problem',                   pr:'ha-KU-na SHI-da',                tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'No problem'},{english:'No difficulty'},{english:"That's fine"}], ex:{swahili:'Asante kwa subira. — Hakuna shida.', english:'Thank you for your patience. — No problem.'} },
    { id:'phr-043', sw:'Subiri kidogo',            en:'Wait a moment',                pr:'su-BI-ri ki-DO-go',              tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'Wait a moment'},{english:'Just a moment'},{english:'Hold on a second'}], ex:{swahili:'Subiri kidogo, ninakuja!', english:"Wait a moment, I'm coming!"} },
    { id:'phr-044', sw:'Niko sawa',                en:"I'm okay",                     pr:'NI-ko SA-wa',                    tags:['phrases','daily-life'], register:'neutral',  senses:[{english:"I'm okay"},{english:"I'm fine"},{english:"I'm alright"}], ex:{swahili:'Una hali gani? — Niko sawa, asante.', english:"How are you doing? — I'm okay, thanks."} },
    { id:'phr-045', sw:'Ninahitaji msaada',        en:'I need help',                  pr:'ni-na-hi-TA-ji m-SA-a-da',       tags:['phrases','requests'],   register:'neutral',  senses:[{english:'I need help'},{english:'I need assistance'}], ex:{swahili:"Ninahitaji msaada — nimepotea.", english:"I need help — I'm lost."} },
    { id:'phr-046', sw:'Lazima',                   en:'It is necessary',              pr:'la-ZI-ma',                       tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'It is necessary'},{english:'Must'},{english:'Have to'},{english:'Obligatory'}], ex:{swahili:'Lazima twende sasa hivi.', english:'We must go right now.'} },
    { id:'phr-047', sw:'Sijali',                   en:"I don't mind",                 pr:'si-JA-li',                       tags:['phrases','daily-life'], register:'neutral',  senses:[{english:"I don't mind"},{english:"It doesn't matter to me"},{english:"Either is fine"}], ex:{swahili:"Chai au kahawa? — Sijali, vyote vizuri.", english:"Tea or coffee? — I don't mind, both are fine."} },
    { id:'phr-048', sw:'Niko hapa',                en:'I am here',                    pr:'NI-ko HA-pa',                    tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'I am here'},{english:"I'm present"},{english:'Over here'}], ex:{swahili:'Uko wapi? — Niko hapa, nyuma yako!', english:"Where are you? — I'm here, behind you!"} },
    { id:'phr-049', sw:'Ninaangalia tu',           en:'Just looking',                 pr:'ni-na-a-NGA-li-a TU',            tags:['phrases','shopping'],   register:'neutral',  senses:[{english:'Just looking'},{english:'Just browsing'},{english:'Only looking'}], ex:{swahili:'Ninaweza kukusaidia? — Ninaangalia tu, asante.', english:'Can I help you? — Just looking, thank you.'} },
    { id:'phr-050', sw:'Nipe muda kidogo',         en:'Give me a little time',        pr:'NI-pe MU-da ki-DO-go',           tags:['phrases','requests'],   register:'neutral',  senses:[{english:'Give me a little time'},{english:'Just a moment'},{english:'Bear with me'}], ex:{swahili:'Nipe muda kidogo — ninafikiria.', english:'Give me a little time — I am thinking.'} },

    // ── Discourse markers ────────────────────────────────────────────────────
    { id:'phr-051', sw:'Kwa kweli',                en:'Truly',                        pr:'kwa KWE-li',                     tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Truly'},{english:'Really'},{english:'Indeed'},{english:'In truth'}], ex:{swahili:'Kwa kweli, sikujua hivyo.', english:"Truly, I didn't know that."} },
    { id:'phr-052', sw:'Bila shaka',               en:'Without doubt',                pr:'BI-la SHA-ka',                   tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Without doubt'},{english:'Certainly'},{english:'Definitely'},{english:'Of course'}], ex:{swahili:'Bila shaka, atakuja.', english:'Without doubt, he will come.'} },
    { id:'phr-053', sw:'Hata hivyo',               en:'Even so',                      pr:'HA-ta HI-vyo',                   tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Even so'},{english:'Nevertheless'},{english:'However'},{english:'Despite that'}], ex:{swahili:'Hata hivyo, tutaendelea.', english:'Even so, we will continue.'} },
    { id:'phr-054', sw:'Kwa hiyo',                 en:'Therefore',                    pr:'kwa HI-yo',                      tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Therefore'},{english:'So'},{english:'For that reason'},{english:'Thus'}], ex:{swahili:'Nilichelewa, kwa hiyo nilikimbia.', english:'I was late, so I ran.'} },
    { id:'phr-055', sw:'Kisha',                    en:'Then',                         pr:'KI-sha',                         tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Then'},{english:'After that'},{english:'Next'},{english:'Subsequently'}], ex:{swahili:'Kwanza osha mikono, kisha ule.', english:'First wash your hands, then eat.'} },
    { id:'phr-056', sw:'Mwishowe',                 en:'Finally',                      pr:'mwi-SHO-we',                     tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Finally'},{english:'At the end'},{english:'Ultimately'},{english:'Last of all'}], ex:{swahili:'Mwishowe, tulipata jibu.', english:'Finally, we got the answer.'} },
    { id:'phr-057', sw:'Kwa bahati nzuri',         en:'Fortunately',                  pr:'kwa ba-HA-ti NZU-ri',            tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Fortunately'},{english:'Luckily'},{english:'By good luck'}], ex:{swahili:'Kwa bahati nzuri, mvua haikuanza.', english:"Fortunately, the rain didn't start."} },
    { id:'phr-058', sw:'Kwa bahati mbaya',         en:'Unfortunately',                pr:'kwa ba-HA-ti MBA-ya',            tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Unfortunately'},{english:'Sadly'},{english:'By bad luck'}], ex:{swahili:'Kwa bahati mbaya, tikiti hazikuwepo.', english:'Unfortunately, there were no tickets.'} },
    { id:'phr-059', sw:'Kwa mfano',                en:'For example',                  pr:'kwa m-FA-no',                    tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'For example'},{english:'For instance'},{english:'Such as'}], ex:{swahili:'Kuna matunda mengi, kwa mfano maembe na ndizi.', english:'There are many fruits, for example mangoes and bananas.'} },

    // ── Requests ────────────────────────────────────────────────────────────
    { id:'phr-060', sw:'Niambie',                  en:'Tell me',                      pr:'ni-am-BI-e',                     tags:['phrases','requests'],   register:'neutral',  senses:[{english:'Tell me'},{english:'Let me know'}], ex:{swahili:'Niambie ukweli, tafadhali.', english:'Tell me the truth, please.'} },
    { id:'phr-061', sw:'Nionyeshe',                en:'Show me',                      pr:'ni-o-NYE-she',                   tags:['phrases','requests'],   register:'neutral',  senses:[{english:'Show me'},{english:'Demonstrate to me'},{english:'Let me see'}], ex:{swahili:'Nionyeshe jinsi ya kufanya hivyo.', english:'Show me how to do that.'} },
    { id:'phr-062', sw:'Ninaomba',                 en:'I humbly request',             pr:'ni-na-OM-ba',                    tags:['phrases','requests'],   register:'formal',   senses:[{english:'I request'},{english:'I ask'},{english:'I humbly ask'}], note:'More formal or humble than "ninataka". Common in official contexts or when being very polite.', ex:{swahili:'Ninaomba msamaha kwa ucheleweshaji.', english:'I ask for forgiveness for the delay.'} },

    // ── Shopping ────────────────────────────────────────────────────────────
    { id:'phr-063', sw:'Ni ghali sana',            en:"It's very expensive",          pr:'ni GHA-li SA-na',                tags:['phrases','shopping'],   register:'neutral',  senses:[{english:"It's very expensive"},{english:"That's too expensive"},{english:'Very pricey'}], ex:{swahili:'Elfu thelathini? Ni ghali sana!', english:"Thirty thousand? That's very expensive!"} },
    { id:'phr-064', sw:'Punguza bei',              en:'Reduce the price',             pr:'pu-NGU-za BE-i',                 tags:['phrases','shopping'],   register:'neutral',  senses:[{english:'Reduce the price'},{english:'Give a discount'},{english:'Lower the cost'}], note:'Common phrase in market bargaining — politely asking for a discount.', ex:{swahili:'Unaweza punguza bei kidogo?', english:'Can you reduce the price a little?'} },

    // ── Health & emergency ───────────────────────────────────────────────────
    { id:'phr-065', sw:'Msaada!',                  en:'Help!',                        pr:'m-SA-a-da',                      tags:['phrases','emergency'],  register:'neutral',  senses:[{english:'Help!'},{english:'Assistance!'},{english:'Aid!'}], ex:{swahili:'Msaada! Mtu amepotea!', english:'Help! Someone is missing!'} },
    { id:'phr-066', sw:'Ninahisi vibaya',          en:'I feel unwell',                pr:'ni-na-HI-si vi-BA-ya',           tags:['phrases','health'],     register:'neutral',  senses:[{english:'I feel unwell'},{english:'I feel bad'},{english:"I don't feel well"}], ex:{swahili:"Ninahisi vibaya — ninahitaji daktari.", english:"I feel unwell — I need a doctor."} },
    { id:'phr-067', sw:'Ninahisi vizuri',          en:'I feel well',                  pr:'ni-na-HI-si vi-ZU-ri',           tags:['phrases','health'],     register:'neutral',  senses:[{english:'I feel well'},{english:'I feel good'},{english:"I'm feeling fine"}], ex:{swahili:"Habari ya afya? — Ninahisi vizuri, asante.", english:"How's your health? — I feel well, thank you."} },
    { id:'phr-068', sw:'Nimepotea',                en:"I'm lost",                     pr:'ni-me-po-TE-a',                  tags:['phrases','emergency'],  register:'neutral',  senses:[{english:"I'm lost"},{english:'I have lost my way'}], ex:{swahili:"Samahani, nimepotea — unaweza kunisaidia?", english:"Excuse me, I'm lost — can you help me?"} },

    // ── Encouragement & social ───────────────────────────────────────────────
    { id:'phr-069', sw:'Hongera!',                 en:'Congratulations!',             pr:'hon-GE-ra',                      tags:['phrases','emotions'],   register:'neutral',  senses:[{english:'Congratulations!'},{english:'Well done!'},{english:'Bravo!'}], note:'Used for achievements, births, graduations, weddings — any positive milestone.', ex:{swahili:'Hongera kwa kuhitimu!', english:'Congratulations on graduating!'} },
    { id:'phr-070', sw:'Kazi nzuri!',              en:'Good work!',                   pr:'KA-zi NZU-ri',                   tags:['phrases','encouragement'], register:'neutral', senses:[{english:'Good work!'},{english:'Well done!'},{english:'Nice job!'}], ex:{swahili:"Umefanikisha kazi hiyo — kazi nzuri!", english:"You've accomplished that task — good work!"} },
    { id:'phr-071', sw:'Endelea',                  en:'Continue',                     pr:'en-de-LE-a',                     tags:['phrases','encouragement'], register:'neutral', senses:[{english:'Continue'},{english:'Keep going'},{english:'Carry on'},{english:'Go ahead'}], ex:{swahili:'Endelea, unafanya vizuri sana!', english:"Keep going, you're doing very well!"} },
    { id:'phr-072', sw:'Usijali',                  en:"Don't worry",                  pr:'u-si-JA-li',                     tags:['phrases','encouragement'], register:'neutral', senses:[{english:"Don't worry"},{english:"Don't stress"},{english:"Don't be troubled"}], ex:{swahili:'Usijali, kila kitu kitakuwa sawa.', english:"Don't worry, everything will be okay."} },

    // ── Conversation fillers ─────────────────────────────────────────────────
    { id:'phr-073', sw:'Kwa kweli?',               en:'Really?',                      pr:'kwa KWE-li',                     tags:['phrases','conversation'], register:'neutral', senses:[{english:'Really?'},{english:'Is that so?'},{english:'Truly?'}], ex:{swahili:'Alifaulu mitihani yote. — Kwa kweli?', english:'He passed all the exams. — Really?'} },
    { id:'phr-074', sw:'Si mbaya',                 en:'Not bad',                      pr:'si MBA-ya',                      tags:['phrases','conversation'], register:'informal',senses:[{english:'Not bad'},{english:'Pretty good'},{english:'Not too bad'}], ex:{swahili:'Ulifanya vipi mtihani? — Si mbaya!', english:'How did the exam go? — Not bad!'} },
    { id:'phr-075', sw:'Ndiyo, kweli',             en:'Yes, really',                  pr:'NDI-yo KWE-li',                  tags:['phrases','conversation'], register:'neutral', senses:[{english:'Yes, really'},{english:'Yes, indeed'},{english:'Yes, truly'}], ex:{swahili:'Nilimwona Jana. — Ndiyo, kweli?', english:'I saw him yesterday. — Yes, really?'} },
  ];

  for (const p of PHRASE_SEEDS) {
    _db.run(
      `INSERT OR IGNORE INTO cards
         (id, swahili, english, pronunciation, type, tags, base_difficulty, frequency_rank,
          quick_learn, unit_id, source, example_sentences, register, part_of_speech,
          senses, placement_only, cultural_note)
       VALUES (?,?,?,?,?,?,?,?,1,'unit-00-phrases','handwritten',?,?,?,?,0,?)`,
      [p.id, p.sw, p.en, p.pr, 'phrase', JSON.stringify(p.tags), 0.3, 1,
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
  }

  // B-02: Morphological rule cards (idempotent — INSERT OR IGNORE)
  _db.run(`INSERT OR IGNORE INTO units
    (id, name, description, level, order_index, prerequisite_ids, grammar_notes, estimated_hours)
    VALUES ('unit-00-grammar','Morphology Rules',
      'The building blocks that generate Swahili verb conjugations and noun agreement',
      1,-2,'[]',
      'Swahili is agglutinative — words are built by stacking morpheme slots. Mastering these ~20 slots lets you generate any conjugation rather than memorising each form individually.',
      3)`);

  interface GrammarSeed {
    id: string; sw: string; en: string; pr: string;
    tags: string[]; note: string;
    ex: { swahili: string; english: string };
  }

  const GRAMMAR_SEEDS: GrammarSeed[] = [
    // ── Subject prefixes ─────────────────────────────────────────────────────
    { id:'gr-001', sw:'ni-',      en:'I (1st person singular subject)',       pr:'ni',      tags:['grammar','subject-prefix','morphology'], note:'Verb structure: SUBJECT + TENSE + (OBJECT) + ROOT + FINAL. "ni-" is always first. Example pattern: ni-na-pend-a (I love).', ex:{swahili:'Ni-na-penda = ni + na + pend + a', english:'I love = I + [present] + love + [active]'} },
    { id:'gr-002', sw:'u-',       en:'you (2nd person singular subject)',      pr:'u',       tags:['grammar','subject-prefix','morphology'], note:'"u-" is the 2nd person singular subject prefix. Also used as the U-noun class prefix — context distinguishes them.', ex:{swahili:'U-na-kula = u + na + kul + a', english:'You are eating = you + [present] + eat + [active]'} },
    { id:'gr-003', sw:'a-',       en:'he / she (3rd person singular subject)', pr:'a',       tags:['grammar','subject-prefix','morphology'], note:'Swahili has no grammatical gender — "a-" covers both he and she.', ex:{swahili:'A-na-kuja = a + na + kuj + a', english:'He/she is coming = he/she + [present] + come + [active]'} },
    { id:'gr-004', sw:'tu-',      en:'we (1st person plural subject)',         pr:'tu',      tags:['grammar','subject-prefix','morphology'], note:'"tu-" for we. Negative: "hatu-".', ex:{swahili:'Tu-ta-kwenda = tu + ta + kwend + a', english:'We will go = we + [future] + go + [active]'} },
    { id:'gr-005', sw:'m-',       en:'you all (2nd person plural subject)',    pr:'m',       tags:['grammar','subject-prefix','morphology'], note:'"m-" for plural you. Not to be confused with the M-Mi noun class prefix. Negative: "ham-".', ex:{swahili:'M-na-sema = m + na + sem + a', english:'You all are speaking = you(pl) + [present] + speak + [active]'} },
    { id:'gr-006', sw:'wa-',      en:'they (3rd person plural subject)',       pr:'wa',      tags:['grammar','subject-prefix','morphology'], note:'"wa-" is the plural of "a-" for M-Wa class nouns (people). Other noun classes have different plural subject prefixes.', ex:{swahili:'Wa-ta-lala = wa + ta + lal + a', english:'They will sleep = they + [future] + sleep + [active]'} },

    // ── Tense markers ────────────────────────────────────────────────────────
    { id:'gr-007', sw:'-na-',     en:'present / ongoing tense marker',        pr:'na',      tags:['grammar','tense-marker','morphology','present-tense'], note:'Marks ongoing or habitual present action. Position: after subject prefix. ni-NA-penda (I love / I am loving).', ex:{swahili:'Ni-na-soma vitabu', english:'I am reading books (right now / habitually)'} },
    { id:'gr-008', sw:'-li-',     en:'simple past tense marker',              pr:'li',      tags:['grammar','tense-marker','morphology','past-tense'], note:'Marks completed past action. ni-LI-kula = I ate. Negative past uses -ku- instead of -li-.', ex:{swahili:'A-li-maliza kazi', english:'He/she finished work'} },
    { id:'gr-009', sw:'-ta-',     en:'future tense marker',                   pr:'ta',      tags:['grammar','tense-marker','morphology','future-tense'], note:'Marks future action. ni-TA-kwenda = I will go. No negative form — use subjunctive or "sitakwenda".', ex:{swahili:'Tu-ta-ona kesho', english:'We will see (each other) tomorrow'} },
    { id:'gr-010', sw:'-me-',     en:'perfect tense marker (completed action)', pr:'me',    tags:['grammar','tense-marker','morphology','perfect-tense'], note:'Marks an action completed with present relevance. ni-ME-kula = I have eaten (and I\'m full now). Different from -li- which is simple past.', ex:{swahili:'A-me-fika tayari', english:'He/she has already arrived'} },
    { id:'gr-011', sw:'-ki-',     en:'simultaneous / conditional tense marker', pr:'ki',   tags:['grammar','tense-marker','morphology','conditional'], note:'Marks an action happening at the same time as another, or a conditional ("if/when"). ni-KI-kuja = when I come / if I come.', ex:{swahili:'U-ki-taka, nipe', english:'If/when you want, give me (it)'} },
    { id:'gr-012', sw:'-ka-',     en:'narrative / sequential past marker',    pr:'ka',      tags:['grammar','tense-marker','morphology','past-tense'], note:'Used in storytelling to chain events: "then he did X, then Y". Cannot start a sentence — always follows another verb. ni-ka-ona = and then I saw.', ex:{swahili:'Alikimbia, a-ka-anguka', english:'He ran, and then he fell'} },
    { id:'gr-013', sw:'-nge-',    en:'hypothetical / conditional marker',     pr:'nge',     tags:['grammar','tense-marker','morphology','conditional'], note:'"If I were to…" — counterfactual. ni-NGE-penda = I would love (if conditions were met). With -li-: ningeli- for past hypotheticals.', ex:{swahili:'Ni-nge-penda kwenda Paris', english:'I would like to go to Paris'} },

    // ── Negative markers ─────────────────────────────────────────────────────
    { id:'gr-014', sw:'si-',      en:'I do not / I am not (1sg negative)',    pr:'si',      tags:['grammar','negation','morphology'], note:'Negative counterpart of "ni-". Replaces the subject prefix in negative present. si-pendi = I don\'t like. NOTE: "si" alone means "is not" (si mwalimu = is not a teacher).', ex:{swahili:'Si-pendi kahawa', english:"I don't like coffee"} },
    { id:'gr-015', sw:'hau-',     en:'you do not (2sg negative present)',     pr:'ha-u',    tags:['grammar','negation','morphology'], note:'Negative of "u-". ha + u = hau. Similarly: hatu- (we don\'t), ham- (you all don\'t), hawa- (they don\'t).', ex:{swahili:'Hau-somi kwa bidii', english:"You don't study hard"} },
    { id:'gr-016', sw:'ha-',      en:'negative prefix (3rd person / plural)', pr:'ha',      tags:['grammar','negation','morphology'], note:'"ha-" is added before 3sg and plural subject prefixes in the negative: ha+a=ha (he/she), ha+wa=hawa (they), ha+ki=haki (Ki class), etc.', ex:{swahili:'Ha-kuli chakula', english:"He/she doesn't eat food"} },
    { id:'gr-017', sw:'-ku-',     en:'negative tense marker (past & general)', pr:'ku',    tags:['grammar','negation','morphology'], note:'In negative past, -li- becomes -ku-: ha-KU-kula = he didn\'t eat. In general negatives (timeless), -ku- also appears: si-KU-penda = I didn\'t/don\'t like.', ex:{swahili:'Ha-ku-maliza kazi', english:"He/she didn't finish work"} },
    { id:'gr-018', sw:'-i',       en:'negative final vowel (replaces -a)',    pr:'i',       tags:['grammar','negation','morphology'], note:'The standard verb final vowel -a changes to -i in the negative present. kupenda → sipend-I (I don\'t love). Exception: monosyllabic roots keep -a.', ex:{swahili:'Si-pend-i = si + pend + i', english:"I don't love = not + love + [negative final]"} },

    // ── Object infixes ───────────────────────────────────────────────────────
    { id:'gr-019', sw:'-ni-',     en:'me (1st person singular object infix)', pr:'ni',      tags:['grammar','object-infix','morphology'], note:'Object infixes go between the tense marker and the verb root. a-na-NI-penda = he loves ME. Position: SUBJ + TENSE + OBJ + ROOT + FINAL.', ex:{swahili:'A-na-ni-ona = a + na + ni + on + a', english:'He/she sees me = he/she + [present] + me + see + [active]'} },
    { id:'gr-020', sw:'-ku-',     en:'you (2nd person singular object infix)', pr:'ku',     tags:['grammar','object-infix','morphology'], note:'"ku-" as object infix means "you". Identical to the negative tense marker and infinitive prefix — context distinguishes them. ni-na-KU-ona = I see you.', ex:{swahili:'Ni-na-ku-penda = I love you', english:'ni + na + ku + pend + a'} },
    { id:'gr-021', sw:'-m- / -mw-',en:'him / her (3sg object infix)',         pr:'m / mw',  tags:['grammar','object-infix','morphology'], note:'-m- before consonants, -mw- before vowels. ni-na-M-penda = I love him/her. ni-na-MW-ona = I see him/her.', ex:{swahili:'A-na-m-saidia rafiki', english:'He/she is helping the friend'} },
    { id:'gr-022', sw:'-tu-',     en:'us (1st person plural object infix)',   pr:'tu',      tags:['grammar','object-infix','morphology'], note:'Object infix for "us". a-na-TU-ambia = he tells us.', ex:{swahili:'A-na-tu-ambia ukweli', english:'He/she tells us the truth'} },
    { id:'gr-023', sw:'-wa-',     en:'them (3rd person plural object infix)', pr:'wa',      tags:['grammar','object-infix','morphology'], note:'Object infix for "them" (M-Wa class). ni-na-WA-ona = I see them.', ex:{swahili:'Ni-na-wa-saidia watoto', english:'I am helping the children'} },

    // ── Infinitive & verb structure ──────────────────────────────────────────
    { id:'gr-024', sw:'ku-',      en:'infinitive prefix (to do…)',            pr:'ku',      tags:['grammar','infinitive','morphology'], note:'Marks verb infinitives. ku-penda = to love, ku-la = to eat. Dropped when conjugated (except monosyllabic roots which keep -ku- as a buffer).', ex:{swahili:'Ninataka ku-lala', english:'I want to sleep'} },
    { id:'gr-025', sw:'SUBJ + TENSE + (OBJ) + ROOT + FINAL', en:'Swahili verb conjugation template', pr:'', tags:['grammar','morphology','verb-structure'], note:'Every conjugated Swahili verb follows this slot order. Example: ni-li-m-penda = I (ni) + past (li) + him/her (m) + love (pend) + active (a). Learning the slots means you can decode any conjugation.', ex:{swahili:'ni-li-m-pend-a', english:'I loved him/her — ni(I) li(past) m(him) pend(love) a(active)'} },

    // ── Final vowels ─────────────────────────────────────────────────────────
    { id:'gr-026', sw:'-a',       en:'active / affirmative final vowel',      pr:'a',       tags:['grammar','final-vowel','morphology'], note:'The standard final vowel for affirmative verbs. kupend-A, kula (ku + l + a). Almost all affirmative conjugations end in -a.', ex:{swahili:'Anasoma, anaimba, anacheza', english:'He reads, sings, plays — all end in -a'} },
    { id:'gr-027', sw:'-e',       en:'subjunctive / polite imperative final vowel', pr:'e', tags:['grammar','final-vowel','morphology','subjunctive'], note:'Used in the subjunctive ("let him…", "so that he…") and polite commands. tafadhali niambi-E = please tell me. Nisaidie = help me (polite request).', ex:{swahili:'Tafadhali niambie', english:'Please tell me (subjunctive -e)'} },
    { id:'gr-028', sw:'-wa',      en:'passive suffix (-wa / -liwa / -iwa)',    pr:'wa',      tags:['grammar','final-vowel','morphology','passive'], note:'Added to the verb root to make it passive. kupenda (to love) → kupendwa (to be loved). kupigwa (to be hit). The agent can be added with "na".', ex:{swahili:'Watoto wa-na-pend-wa', english:'The children are loved (-wa passive)'} },

    // ── Noun classes ─────────────────────────────────────────────────────────
    { id:'gr-029', sw:'M-Wa class: m- / wa-', en:'People noun class (singular/plural)', pr:'m / wa', tags:['grammar','noun-class','morphology'], note:'The most important noun class — all people words. Singular prefix m-/mw- (mtu, mwalimu), plural prefix wa- (watu, walimu). Subject concord: a- (sg) / wa- (pl).', ex:{swahili:'m-tu → wa-tu, m-walimu → wa-limu', english:'person → people, teacher → teachers'} },
    { id:'gr-030', sw:'M-Mi class: m- / mi-', en:'Plants & objects noun class',        pr:'m / mi', tags:['grammar','noun-class','morphology'], note:'Trees, plants, and some objects. m-ti (tree) → mi-ti (trees). Subject concord: u- (sg) / i- (pl). Adjective: mzuri (sg) / mizuri (pl).', ex:{swahili:'m-ti → mi-ti, m-to → mi-to', english:'tree → trees, river → rivers'} },
    { id:'gr-031', sw:'Ki-Vi class: ki- / vi-', en:'Things noun class',               pr:'ki / vi', tags:['grammar','noun-class','morphology'], note:'Things, tools, languages. ki-tabu (book) → vi-tabu (books). ki-tu (thing) → vi-tu (things). Kiswahili is in this class. Subject concord: ki- (sg) / vi- (pl).', ex:{swahili:'ki-tabu → vi-tabu, ki-tu → vi-tu', english:'book → books, thing → things'} },
    { id:'gr-032', sw:'N class: n- / n- (or Ø)',en:'Animals & loanwords noun class',  pr:'n',      tags:['grammar','noun-class','morphology'], note:'Animals, insects, loanwords. No change between singular and plural (ndizi = banana/bananas). Subject concord: i- (sg) / zi- (pl). Many loanwords fall here: simu (phone).', ex:{swahili:'n-dizi → n-dizi, n-jiwa → n-jiwa', english:'banana(s), dove(s) — same form'} },
    { id:'gr-033', sw:'Ma class: Ø / ma-',    en:'Collective & augmentative noun class', pr:'ma',   tags:['grammar','noun-class','morphology'], note:'Collectives, liquids, abstracts, and some augmentatives. Singular often has no prefix. ji-cho (eye) → ma-cho (eyes). Subject concord: li- (sg) / ya- (pl).', ex:{swahili:'tunda → ma-tunda, ji-cho → ma-cho', english:'fruit → fruits, eye → eyes'} },
    { id:'gr-034', sw:'U class: u- / Ø or ny-', en:'Abstract & long things noun class', pr:'u',   tags:['grammar','noun-class','morphology'], note:'Abstract nouns, long thin things, some body parts. u-kuta (wall) → kuta (walls). u-furaha (happiness) — abstract, no plural. Subject concord: u- (sg) / zi- (pl) for concrete; u- only for abstract.', ex:{swahili:'u-kuta → kuta, u-furaha (no plural)', english:'wall → walls, happiness (abstract)'} },

    // ── Concord ──────────────────────────────────────────────────────────────
    { id:'gr-035', sw:'M-Wa adjective concord: mzuri / wazuri', en:'M-Wa class adjective agreement', pr:'m / wa', tags:['grammar','concord','morphology'], note:'Adjectives must agree with the noun\'s class and number. M-Wa class: m-zuri (good person, sg), wa-zuri (good people, pl). The adjective prefix mirrors the noun prefix.', ex:{swahili:'mtu m-zuri → watu wa-zuri', english:'a good person → good people'} },
    { id:'gr-036', sw:'Ki-Vi adjective concord: kizuri / vizuri', en:'Ki-Vi class adjective agreement', pr:'ki / vi', tags:['grammar','concord','morphology'], note:'Ki-Vi class: ki-zuri (good thing, sg), vi-zuri (good things, pl). The same root -zuri takes different prefixes depending on the noun class.', ex:{swahili:'kitu ki-zuri → vitu vi-zuri', english:'a good thing → good things'} },
    { id:'gr-037', sw:'M-Mi subject concord: u-na / i-na', en:'M-Mi class subject-verb agreement', pr:'u / i', tags:['grammar','concord','morphology'], note:'When an M-Mi noun is the subject, the verb uses u- (sg) or i- (pl). mti u-na-anguka (the tree falls), miti i-na-anguka (the trees fall).', ex:{swahili:'m-ti u-na-anguka → mi-ti i-na-anguka', english:'the tree falls → the trees fall'} },
    { id:'gr-038', sw:'Ki-Vi subject concord: ki-na / vi-na', en:'Ki-Vi class subject-verb agreement', pr:'ki / vi', tags:['grammar','concord','morphology'], note:'Ki-Vi subject concord: ki- (sg), vi- (pl). kitabu ki-na-anguka (the book falls), vitabu vi-na-anguka (the books fall).', ex:{swahili:'ki-tabu ki-na-anguka → vi-tabu vi-na-anguka', english:'the book falls → the books fall'} },

    // ── Useful derivational morphology ───────────────────────────────────────
    { id:'gr-039', sw:'-sha / -isha',  en:'causative suffix (to cause/make someone do)', pr:'sha / isha', tags:['grammar','derivation','morphology'], note:'Added to a verb root to make it causative. kula (eat) → ku-lisha (to feed = to cause to eat). soma (read/study) → somesha (to teach = to cause to learn). Very productive.', ex:{swahili:'kula → ku-l-isha (to feed), lala → lal-isha (to put to sleep)', english:'eat → to feed, sleep → to put to sleep'} },
    { id:'gr-040', sw:'-ni',           en:'locative suffix (at/in a place)',             pr:'ni',         tags:['grammar','locative','morphology'], note:'Added to place nouns to mean "at/in". nyumba-NI (at home), shule-NI (at school), sokoni (at the market). The noun loses its final vowel before -ni if it ends in -a.', ex:{swahili:'nyumba → nyumba-ni, shule → shule-ni', english:'house → at home, school → at school'} },
    { id:'gr-041', sw:'-ana',          en:'reciprocal suffix (each other)',              pr:'a-na',       tags:['grammar','derivation','morphology'], note:'Added to a verb root to express mutual action. penda (love) → pend-ana (love each other). ona (see) → on-ana (see each other / meet). Very common in daily speech.', ex:{swahili:'kupend-ana, kuon-ana, kusalim-ana', english:'to love each other, to meet, to greet each other'} },
    { id:'gr-042', sw:'-eka / -ikana', en:'stative suffix (able to be / in a state)',   pr:'e-ka / i-ka-na', tags:['grammar','derivation','morphology'], note:'Marks a state or possibility. fungua (open) → fugu-ka (be opened, be openable). vunja (break) → vonj-eka (be breakable). Expresses inherent properties or states.', ex:{swahili:'fungu-ka (be opened), vunj-ika (be broken)', english:'to be openable, to be breakable'} },
  ];

  for (const g of GRAMMAR_SEEDS) {
    _db.run(
      `INSERT OR IGNORE INTO cards
         (id, swahili, english, pronunciation, type, tags, base_difficulty, frequency_rank,
          quick_learn, unit_id, source, example_sentences, register, part_of_speech,
          senses, placement_only, cultural_note)
       VALUES (?,?,?,?,?,?,?,?,1,'unit-00-grammar','handwritten',?,?,?,?,0,?)`,
      [g.id, g.sw, g.en, g.pr, 'grammar', JSON.stringify(g.tags), 0.4, 1,
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
  if (!('new_word_rate' in settings)) {
    (settings as Partial<ProfileSettings>).new_word_rate = 20;
    dirty = true;
  }
  // A-04: migrate new preference fields with sensible defaults
  if (!('show_example_sentences' in settings)) {
    (settings as Partial<ProfileSettings>).show_example_sentences = true;
    dirty = true;
  }
  if (!('gamification_enabled' in settings)) {
    (settings as Partial<ProfileSettings>).gamification_enabled = true;
    dirty = true;
  }
  if (!('grammar_depth' in settings)) {
    (settings as Partial<ProfileSettings>).grammar_depth = 'fluency';
    dirty = true;
  }
  if (!('exercise_direction' in settings)) {
    (settings as Partial<ProfileSettings>).exercise_direction = 'balanced';
    dirty = true;
  }
  if (!('pronunciation_style' in settings)) {
    (settings as Partial<ProfileSettings>).pronunciation_style = 'syllable';
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
    response_time_avg_ms: row.response_time_avg_ms as number | null ?? null,
    starred: (row.starred as number) === 1,
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
    register: row.register as Card['register'],
    morpheme_breakdown: row.morpheme_breakdown ? JSON.parse(row.morpheme_breakdown as string) : undefined,
    part_of_speech: row.part_of_speech as Card['part_of_speech'],
    etymology: row.etymology as Card['etymology'],
    dialect: row.dialect as Card['dialect'],
    cultural_note: row.cultural_note as string | undefined,
    senses: row.senses ? JSON.parse(row.senses as string) : undefined,
    placement_only: (row.placement_only as number) === 1,
    state,
  };
}

export async function getDueCards(nowIso: string): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count,
            cs.response_time_avg_ms, cs.starred
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
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count,
            cs.response_time_avg_ms, cs.starred
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
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count,
            cs.response_time_avg_ms, cs.starred
     FROM cards c
     JOIN card_states cs ON cs.card_id = c.id
     WHERE cs.depth_level IN (2.5, 4, 4.5, 5.1, 5.2, 5.3)
       AND (c.placement_only = 0 OR c.placement_only IS NULL)`,
  ).map(buildCardWithState);
}

export async function getIntroducedCards(): Promise<CardWithState[]> {
  return query<Record<string, unknown>>(
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count,
            cs.response_time_avg_ms, cs.starred
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
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count,
            cs.response_time_avg_ms, cs.starred
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
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count,
            cs.response_time_avg_ms, cs.starred
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
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count,
            cs.response_time_avg_ms, cs.starred
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
    `SELECT * FROM units WHERE order_index >= ? AND id != 'unit-00-placement' ORDER BY order_index ASC LIMIT 1`,
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
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count,
            cs.response_time_avg_ms, cs.starred
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
  let where = `(c.swahili LIKE ? OR c.english LIKE ?) AND (c.placement_only = 0 OR c.placement_only IS NULL) AND cs.depth_level > 1`;
  if (typeFilter) { where += ` AND c.type = ?`; params.push(typeFilter); }
  if (unitId)     { where += ` AND c.unit_id = ?`; params.push(unitId); }
  if (statusFilter === 'new')       { where += ` AND cs.depth_level = 1`; }
  if (statusFilter === 'learning')  { where += ` AND cs.depth_level IN (2, 2.5)`; }
  if (statusFilter === 'known')     { where += ` AND cs.depth_level IN (3, 4, 4.5)`; }
  if (statusFilter === 'mastered')  { where += ` AND cs.depth_level IN (5.1, 5.2, 5.3)`; }
  if (statusFilter === 'starred')   { where += ` AND cs.starred = 1`; }
  params.push(limit);
  return query<Record<string, unknown>>(
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count,
            cs.response_time_avg_ms, cs.starred
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
    `SELECT c.*, cs.card_id, cs.depth_level, cs.stability, cs.difficulty, cs.retrievability,
            cs.last_review, cs.next_review, cs.review_count, cs.lapse_count,
            cs.consecutive_correct, cs.fast_learn_level, cs.fast_learn_fail_count,
            cs.response_time_avg_ms, cs.starred
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

function buildCard(row: Record<string, unknown>): Card {
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
    register: row.register as Card['register'],
    morpheme_breakdown: row.morpheme_breakdown ? JSON.parse(row.morpheme_breakdown as string) : undefined,
    part_of_speech: row.part_of_speech as Card['part_of_speech'],
    etymology: row.etymology as Card['etymology'],
    dialect: row.dialect as Card['dialect'],
    cultural_note: row.cultural_note as string | undefined,
    senses: row.senses ? JSON.parse(row.senses as string) : undefined,
    placement_only: (row.placement_only as number) === 1,
  };
}

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
  ).map(buildCard);
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
