/**
 * Schema & content migrations — run on every `openDatabase()`.
 *
 * Migrations are declared in the ordered `MIGRATIONS` array below. On open,
 * `runMigrations()` applies every migration whose `version` is greater than the
 * DB's current recorded version, in ascending order, then records the new
 * version. Each migration must be idempotent (it may re-run if a prior open was
 * interrupted before the version was written).
 *
 * To add a schema/content change: append a new `{ version: N, run }` entry.
 *
 * All the content-transformation helpers below are used only by migrations
 * (back-filling fields on user DBs that pre-date later template changes), which
 * is why they live here rather than in the runtime query layer (`db.ts`).
 */

import pluralize from 'pluralize';
import type { Database } from 'sql.js';
import { fixGrammarContent } from './grammarFixes';
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

// ─── Migration-version bookkeeping ────────────────────────────────────────────

export function ensureMigrationTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

export function getMigrationVersion(db: Database): number {
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

// ─── v1: legacy migration bundle ──────────────────────────────────────────────
// Create/alter tables and content fixes added after the template DB was
// generated. Tracked so future opens do not rerun the full content repair pass
// on every launch.
function runLegacyMigration(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS skill_mastery (
      skill_tag     TEXT PRIMARY KEY,
      opportunities INTEGER NOT NULL DEFAULT 0,
      correct       INTEGER NOT NULL DEFAULT 0,
      updated_at    TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS error_patterns (
      skill_tag  TEXT NOT NULL,
      error_type TEXT NOT NULL,
      count      INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (skill_tag, error_type)
    )
  `);
  // ALTER TABLE doesn't support IF NOT EXISTS — use try/catch
  try { db.run('ALTER TABLE review_logs ADD COLUMN error_type TEXT'); } catch { /* already exists */ }

  // A-01: card metadata columns
  try { db.run("ALTER TABLE cards ADD COLUMN register TEXT DEFAULT 'neutral'"); } catch { /* already exists */ }
  try { db.run('ALTER TABLE cards ADD COLUMN morpheme_breakdown TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE cards ADD COLUMN part_of_speech TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE cards ADD COLUMN etymology TEXT'); } catch { /* already exists */ }
  try { db.run("ALTER TABLE cards ADD COLUMN dialect TEXT DEFAULT 'standard'"); } catch { /* already exists */ }
  try { db.run('ALTER TABLE cards ADD COLUMN cultural_note TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE cards ADD COLUMN senses TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE cards ADD COLUMN placement_only INTEGER DEFAULT 0'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE cards ADD COLUMN noun_class TEXT'); } catch { /* already exists */ }

  // Populate noun_class for known vocabulary words (idempotent — only sets NULL rows)
  for (const [word, cls] of Object.entries(NOUN_CLASS_MAP)) {
    db.run(
      `UPDATE cards SET noun_class = ? WHERE swahili = ? AND type = 'vocabulary' AND noun_class IS NULL`,
      [cls, word],
    );
  }

  // A-02: response time tracking on card states
  try { db.run('ALTER TABLE card_states ADD COLUMN response_time_avg_ms REAL'); } catch { /* already exists */ }

  // A-03: morpheme-level mastery table
  db.run(`
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
  try { db.run('ALTER TABLE card_states ADD COLUMN starred INTEGER DEFAULT 0'); } catch { /* already exists */ }

  // D-01: Fix "(plural)" English labels — convert "bad child (plural)" → "bad children" etc.
  // Idempotent: only touches rows that still carry the old marker.
  {
    const rows = db.exec(
      "SELECT id, english FROM cards WHERE english LIKE '%(plural)%' AND english NOT LIKE 'you%'"
    );
    if (rows.length && rows[0].values.length) {
      db.run('BEGIN');
      for (const [id, en] of rows[0].values as [string, string][]) {
        const fixed = _fixPluralEnglish(en);
        if (fixed) db.run('UPDATE cards SET english = ? WHERE id = ?', [fixed, id]);
      }
      db.run('COMMIT');
    }
  }

  // B-04: placement test seed data (idempotent — INSERT OR IGNORE)
  db.run(`INSERT OR IGNORE INTO units
    (id, name, description, level, order_index, prerequisite_ids, grammar_notes, estimated_hours)
    VALUES ('unit-00-placement','Placement Test','Diagnostic cards used to determine your starting level',1,0,'[]','',0)`);


  for (const c of PLACEMENT_SEEDS) {
    db.run(
      `INSERT OR IGNORE INTO cards
         (id, swahili, english, pronunciation, type, tags, base_difficulty, frequency_rank,
          quick_learn, unit_id, source, example_sentences, register, part_of_speech,
          senses, placement_only)
       VALUES (?,?,?,?,?,?,?,?,0,'unit-00-placement','handwritten',?,?,?,?,1)`,
      [c.id, c.sw, c.en, c.pr, 'vocabulary', JSON.stringify(c.tags), c.diff, c.rank,
       JSON.stringify([c.ex]), 'neutral', c.pos, JSON.stringify(c.senses)],
    );
    db.run(
      `INSERT OR IGNORE INTO card_states
         (card_id, depth_level, stability, difficulty, retrievability,
          last_review, next_review, review_count, lapse_count,
          consecutive_correct, fast_learn_level, fast_learn_fail_count)
       VALUES (?,1,0,0.3,1,NULL,NULL,0,0,0,0,0)`,
      [c.id],
    );
  }

  // B-01: Essential Phrases unit (idempotent — INSERT OR IGNORE)
  db.run(`INSERT OR IGNORE INTO units
    (id, name, description, level, order_index, prerequisite_ids, grammar_notes, estimated_hours)
    VALUES ('unit-00-phrases','Essential Phrases',
      'Everyday communicative phrases for real-world Swahili conversations',
      1,-1,'[]',
      'These are formulaic phrases used in daily speech. Learning them before grammar gives you immediate communicative power.',
      2)`);


  let phraseIdx = 0;
  for (const p of PHRASE_SEEDS) {
    db.run(
      `INSERT OR IGNORE INTO cards
         (id, swahili, english, pronunciation, type, tags, base_difficulty, frequency_rank,
          quick_learn, unit_id, source, example_sentences, register, part_of_speech,
          senses, placement_only, cultural_note)
       VALUES (?,?,?,?,?,?,?,?,1,'unit-00-phrases','handwritten',?,?,?,?,0,?)`,
      [p.id, p.sw, p.en, p.pr, 'phrase', JSON.stringify(p.tags), 0.3, phraseIdx + 1,
       JSON.stringify([p.ex]), p.register, 'phrase', JSON.stringify(p.senses), p.note ?? null],
    );
    db.run(
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
  db.run(`UPDATE cards SET frequency_rank = CAST(SUBSTR(id, 5) AS INTEGER) WHERE id LIKE 'phr-%' AND unit_id = 'unit-00-phrases'`);

  // B-02: Morphological rule cards (idempotent — INSERT OR IGNORE)
  db.run(`INSERT OR IGNORE INTO units
    (id, name, description, level, order_index, prerequisite_ids, grammar_notes, estimated_hours)
    VALUES ('unit-00-grammar','Morphology Rules',
      'The building blocks that generate Swahili verb conjugations and noun agreement',
      1,-2,'[]',
      'Swahili is agglutinative — words are built by stacking morpheme slots. Mastering these ~20 slots lets you generate any conjugation rather than memorising each form individually.',
      3)`);


  let grammarIdx = 0;
  for (const g of GRAMMAR_SEEDS) {
    db.run(
      `INSERT OR IGNORE INTO cards
         (id, swahili, english, pronunciation, type, tags, base_difficulty, frequency_rank,
          quick_learn, unit_id, source, example_sentences, register, part_of_speech,
          senses, placement_only, cultural_note)
       VALUES (?,?,?,?,?,?,?,?,1,'unit-00-grammar','handwritten',?,?,?,?,0,?)`,
      [g.id, g.sw, g.en, g.pr, 'grammar', JSON.stringify(g.tags), 0.4, grammarIdx + 1,
       JSON.stringify([g.ex]), 'neutral', 'particle',
       JSON.stringify([{english: g.en}]), g.note],
    );
    db.run(
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
  db.run(`UPDATE cards SET frequency_rank = CAST(SUBSTR(id, 4) AS INTEGER) WHERE id LIKE 'gr-%' AND unit_id = 'unit-00-grammar'`);

  // Sync improved grammar card content for existing users (idempotent; small fixed seed set).
  for (const g of GRAMMAR_SEEDS) {
    db.run(`UPDATE cards SET english = ?, cultural_note = ? WHERE id = ? AND type = 'grammar'`, [g.en, g.note, g.id]);
  }

  // B-05: Back-fill register column on generated cards using tag patterns (idempotent)
  // Cards that already have an explicit non-neutral register (e.g. handwritten seeds) are left untouched.
  db.run(`UPDATE cards SET register = 'neutral' WHERE register IS NULL`);
  db.run(`UPDATE cards SET register = 'literary'
            WHERE source = 'generated'
              AND register = 'neutral'
              AND (tags LIKE '%"methali"%' OR tags LIKE '%"proverb"%' OR tags LIKE '%"literary"%')`);
  db.run(`UPDATE cards SET register = 'slang'
            WHERE source = 'generated'
              AND register = 'neutral'
              AND (tags LIKE '%"sheng"%' OR tags LIKE '%"slang"%')`);
  db.run(`UPDATE cards SET register = 'informal'
            WHERE source = 'generated'
              AND register = 'neutral'
              AND (tags LIKE '%"informal"%' OR tags LIKE '%"casual"%' OR tags LIKE '%"colloquial"%')`);
  db.run(`UPDATE cards SET register = 'formal'
            WHERE source = 'generated'
              AND register = 'neutral'
              AND (tags LIKE '%"formal"%' OR tags LIKE '%"polite"%' OR tags LIKE '%"honorific"%'
                OR tags LIKE '%"business"%' OR tags LIKE '%"official"%' OR tags LIKE '%"academic"%')`);

  // Content fix: remove stray double-quotes from english field (e.g. 'plural of "child"' → 'plural of child')
  db.run(`UPDATE cards SET english = REPLACE(english, '"', '') WHERE english LIKE '%"%'`);

  // Fix cards introduced with review_count=1 but stability=0 — treat them as new on next review
  db.run(`UPDATE card_states SET review_count = 0 WHERE stability = 0 AND depth_level >= 2`);
  // Promote any in_progress unit to completed if all its cards have been introduced (depth >= 2)
  db.run(`
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
  const missingPron = db.exec(
    `SELECT DISTINCT swahili FROM cards
     WHERE  swahili NOT LIKE '% %'
     AND    type IN ('vocabulary', 'conjugation')
     AND    (pronunciation IS NULL OR pronunciation = '')`
  );
  if (missingPron.length && missingPron[0].values.length > 0) {
    for (const [word] of missingPron[0].values) {
      db.run(
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
    const conjRows = db.exec(
      "SELECT id, english FROM cards WHERE type='conjugation' AND english LIKE '%[%]%'"
    );
    if (conjRows.length && conjRows[0].values.length) {
      db.run('BEGIN');
      for (const [id, en] of conjRows[0].values as [string, string][]) {
        const newEn = _ciTransform(en as string);
        if (newEn && newEn !== en) db.run('UPDATE cards SET english = ? WHERE id = ?', [newEn, id]);
      }
      db.run('COMMIT');
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
    const pluralRows = db.exec(
      "SELECT id, english, swahili FROM cards WHERE english LIKE 'plural of%'"
    );
    if (pluralRows.length && pluralRows[0].values.length) {
      db.run('BEGIN');
      for (const [id, en, sw] of pluralRows[0].values as [string, string, string][]) {
        const swLow = (sw as string).toLowerCase();
        if (_E02_HOMONYMS[swLow]) {
          const h = _E02_HOMONYMS[swLow];
          db.run('UPDATE cards SET english = ?, cultural_note = ? WHERE id = ?', [h.english, h.plNote, id]);
          if (h.singNote) {
            db.run(
              `UPDATE cards SET cultural_note = ? WHERE swahili = ? AND english NOT LIKE 'plural of%' AND (cultural_note IS NULL OR cultural_note = '')`,
              [h.singNote, sw],
            );
          }
          continue;
        }
        const base = (en as string).replace(/^plural of\s+/i, '').trim();
        const pluralized = _pluralizeBase(base);
        const newEn = pluralized.toLowerCase() === base.toLowerCase() ? `${base} (pl)` : pluralized;
        if (newEn !== en) db.run('UPDATE cards SET english = ? WHERE id = ?', [newEn, id]);
      }
      db.run('COMMIT');
    }
  }

  // E-03: Simplify "-zuri" adjective English — "good/beautiful X" → "good X" + cultural note
  // Idempotent: REPLACE on english is always safe; cultural_note only set where absent
  {
    const zuriNote = '-zuri is one of Swahili\'s most versatile adjectives — it covers beautiful, good, nice, fine, and well depending on context.';
    db.run(
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
  try { db.run("ALTER TABLE units ADD COLUMN track TEXT NOT NULL DEFAULT 'vocabulary'"); } catch { /* already exists */ }

  // Mark the 10 grammar-concept units plus the morphology rules unit
  for (const id of ['unit-00-grammar','unit-07','unit-08','unit-09','unit-10','unit-11','unit-14','unit-15','unit-16','unit-17','unit-19']) {
    db.run("UPDATE units SET track = 'grammar' WHERE id = ?", [id]);
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
    db.run('UPDATE units SET prerequisite_ids = ? WHERE id = ?', [JSON.stringify(prereqs), id]);
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
    db.run('UPDATE units SET prerequisite_ids = ? WHERE id = ?', [JSON.stringify(prereqs), id]);
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
    db.run(
      `UPDATE cards SET cultural_note = ? WHERE swahili = ? AND type != 'conjugation' AND (cultural_note IS NULL OR cultural_note = '')`,
      [note, sw],
    );
  }
}

// ─── Migration registry ───────────────────────────────────────────────────────

interface Migration {
  version: number;
  languages?: string[]; // if set, only applies to these language ids (default: all)
  run: (db: Database) => void;
}

function createReviewNotesTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS review_notes (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      language TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      note TEXT NOT NULL,
      suggested_correction TEXT,
      reviewer TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      resolved_at TEXT
    )
  `);
  try { db.run('CREATE INDEX IF NOT EXISTS idx_review_notes_card ON review_notes(card_id)'); } catch { /* old SQLite */ }
  try { db.run('CREATE INDEX IF NOT EXISTS idx_review_notes_status ON review_notes(status)'); } catch { /* old SQLite */ }
}

function createCurriculumInstallTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS curriculum_packages (
      language TEXT PRIMARY KEY,
      package_version INTEGER NOT NULL,
      template_db TEXT NOT NULL,
      installed_scope TEXT NOT NULL DEFAULT 'all',
      installed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS curriculum_unit_versions (
      language TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      unit_version INTEGER NOT NULL DEFAULT 1,
      installed_at TEXT NOT NULL,
      PRIMARY KEY (language, unit_id)
    )
  `);
}

// Ordered list of migrations. Append new entries with the next version number.
// Both current migrations are Swahili content/schema, so they are tagged sw-only —
// they never run on the Korean (or any non-Swahili) DB, which ships fully migrated.
const MIGRATIONS: Migration[] = [
  { version: 1, languages: ['sw'], run: runLegacyMigration },
  // v2: Phase 0 grammar-content correctness repair (negatives, concord, ndiyo).
  { version: 2, languages: ['sw'], run: (db) => fixGrammarContent(db) },
  // v3: local-first curriculum audit notes for every language DB.
  { version: 3, run: createReviewNotesTable },
  // v4: installed curriculum package metadata for future unit-by-unit downloads.
  { version: 4, run: createCurriculumInstallTables },
];

// Applies every migration newer than the DB's recorded version (and applicable to
// the given language), in order, then records the highest known version so a future
// schema migration isn't blocked by a skipped language-specific one.
export function runMigrations(db: Database, lang: string = 'sw'): void {
  ensureMigrationTable(db);
  const current = getMigrationVersion(db);
  let target = current;
  for (const m of MIGRATIONS) {
    if (current < m.version && (!m.languages || m.languages.includes(lang))) {
      m.run(db);
    }
    target = Math.max(target, m.version);
  }
  if (target > current) setMigrationVersion(db, target);
}
