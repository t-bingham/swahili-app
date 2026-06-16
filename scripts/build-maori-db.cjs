/**
 * Builds public/maori_default.db — the Te Reo Māori curriculum seed DB.
 *
 * Same strategy as build-korean-db.cjs:
 *   1) Clone the post-migration Swahili schema (so the runtime needs no
 *      migrations for this language)
 *   2) Wipe all Swahili content
 *   3) Insert Te Reo units + hand-curated cards + generated tense patterns
 *   4) Mark schema as fully migrated; VACUUM; write to public/.
 *
 * Re-run with: node scripts/build-maori-db.cjs
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const initSqlJs = require(path.join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-asm.js'));
const { UNITS, CARDS } = require('./maori-vocab.cjs');
const { VERBS } = require('./maori-verbs.cjs');
const { generatePatterns } = require('./maori-tense.cjs');

const LATEST_MIGRATION_VERSION = 2; // keep in sync with src/database/migrations.ts

initSqlJs().then((SQL) => {
  const swPath = path.join(ROOT, 'public', 'swahili_default.db');
  const db = new SQL.Database(fs.readFileSync(swPath));

  // 1) Bring schema up to the post-migration shape (idempotent ALTERs).
  const alters = [
    "ALTER TABLE cards ADD COLUMN register TEXT DEFAULT 'neutral'",
    'ALTER TABLE cards ADD COLUMN morpheme_breakdown TEXT',
    'ALTER TABLE cards ADD COLUMN part_of_speech TEXT',
    'ALTER TABLE cards ADD COLUMN etymology TEXT',
    "ALTER TABLE cards ADD COLUMN dialect TEXT DEFAULT 'standard'",
    'ALTER TABLE cards ADD COLUMN cultural_note TEXT',
    'ALTER TABLE cards ADD COLUMN senses TEXT',
    'ALTER TABLE cards ADD COLUMN placement_only INTEGER DEFAULT 0',
    'ALTER TABLE card_states ADD COLUMN response_time_avg_ms REAL',
    'ALTER TABLE card_states ADD COLUMN starred INTEGER DEFAULT 0',
    "ALTER TABLE units ADD COLUMN track TEXT NOT NULL DEFAULT 'vocabulary'",
    'ALTER TABLE review_logs ADD COLUMN error_type TEXT',
  ];
  for (const a of alters) { try { db.run(a); } catch (e) { /* column already exists */ } }
  db.run(`CREATE TABLE IF NOT EXISTS skill_mastery (skill_tag TEXT PRIMARY KEY, opportunities INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS error_patterns (skill_tag TEXT NOT NULL, error_type TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (skill_tag, error_type))`);
  db.run(`CREATE TABLE IF NOT EXISTS morpheme_mastery (morpheme TEXT NOT NULL, slot TEXT NOT NULL, opportunities INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (morpheme, slot))`);
  db.run(`CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, applied_at TEXT NOT NULL)`);

  // 2) Wipe all Swahili content.
  for (const t of ['review_logs', 'sessions', 'unit_progress', 'card_states', 'cards', 'units', 'skill_mastery', 'error_patterns', 'morpheme_mastery', 'profile']) {
    db.run(`DELETE FROM ${t}`);
  }

  // 3) Insert Māori units.
  for (const [id, name, desc, level, order_index, track, notes] of UNITS) {
    db.run(
      `INSERT INTO units (id, name, description, level, order_index, prerequisite_ids, grammar_notes, estimated_hours, track)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, name, desc, level, order_index, '[]', notes, 1.0, track],
    );
  }

  // 4) Generate tense-pattern cards from the verb list (Te reo's smaller
  //    "morphological" multiplier — particles bracket the verb, no inflection).
  const reserved = new Set(CARDS.map(c => c.mi));
  const PATTERN_CARDS = generatePatterns(VERBS).filter(p => !reserved.has(p.mi));

  // 5) Insert cards + fresh card_states. Mirror the Korean script's schema bind
  //    (the column names still say "swahili" / "english" / "pronunciation" —
  //    this is the L2 / L1 / pronunciation triad; renaming the columns was
  //    deliberately skipped per the multi-language architecture decision).
  const allCards = [...CARDS, ...PATTERN_CARDS];
  let rank = 1;
  const seenIds = new Set();
  const seenSurface = new Set();
  let autoIdx = 0;
  for (const c of allCards) {
    if (!c.id) {
      autoIdx++;
      c.id = 'mi-v-' + c.unit.replace('mi-unit-', 'u') + '-' + String(autoIdx).padStart(4, '0');
    }
    const dupKey = c.mi + '|' + c.en;
    if (seenIds.has(c.id) || seenSurface.has(dupKey)) continue;
    seenIds.add(c.id);
    seenSurface.add(dupKey);
    const examples = c.ex ? JSON.stringify([{ swahili: c.ex[0], english: c.ex[1] }]) : '[]';
    const source = c.type === 'conjugation' ? 'generated' : 'handwritten';
    db.run(
      `INSERT INTO cards
         (id, swahili, english, pronunciation, type, tags, noun_class, verb_root, conjugation_key,
          base_difficulty, frequency_rank, quick_learn, unit_id, source, prerequisite_card_id,
          example_sentences, register, morpheme_breakdown, part_of_speech, etymology, dialect,
          cultural_note, senses, placement_only)
       VALUES (?,?,?,?,?,?,NULL,?,?,?,?,?,?,?,NULL,?,?,NULL,?,NULL,'standard',?,?,0)`,
      [c.id, c.mi, c.en, c.pron, c.type, JSON.stringify(c.tags || []),
       c.verb_root || null, c.conjugation_key || null,
       2.5, rank, c.type === 'phrase' ? 1 : 0, c.unit, source, examples,
       c.register || 'neutral', c.pos || null,
       c.note || null, JSON.stringify([{ english: c.en }])],
    );
    db.run(
      `INSERT INTO card_states
         (card_id, depth_level, stability, difficulty, retrievability, last_review, next_review,
          review_count, lapse_count, consecutive_correct, fast_learn_level, fast_learn_fail_count,
          response_time_avg_ms, starred)
       VALUES (?,1,0,0.3,1,NULL,NULL,0,0,0,0,0,NULL,0)`,
      [c.id],
    );
    rank++;
  }

  // 6) Mark schema fully migrated so the app runs no Swahili-specific migrations on this DB.
  db.run(
    `INSERT INTO schema_migrations (id, version, applied_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET version = excluded.version, applied_at = excluded.applied_at`,
    [LATEST_MIGRATION_VERSION, new Date().toISOString()],
  );

  // 7) Reclaim freed pages + write out.
  db.run('VACUUM');
  const out = path.join(ROOT, 'public', 'maori_default.db');
  fs.writeFileSync(out, Buffer.from(db.export()));
  const cardCount = db.exec('SELECT COUNT(*) FROM cards')[0].values[0][0];
  const unitCount = db.exec('SELECT COUNT(*) FROM units')[0].values[0][0];
  const grammarCount = db.exec("SELECT COUNT(*) FROM cards WHERE type='grammar'")[0].values[0][0];
  const phraseCount = db.exec("SELECT COUNT(*) FROM cards WHERE type='phrase'")[0].values[0][0];
  const conjCount = db.exec("SELECT COUNT(*) FROM cards WHERE type='conjugation'")[0].values[0][0];
  const vocabCount = db.exec("SELECT COUNT(*) FROM cards WHERE type='vocabulary'")[0].values[0][0];
  console.log(`Wrote ${out}`);
  console.log(`  units: ${unitCount}, cards: ${cardCount}`);
  console.log(`    vocab: ${vocabCount}, phrase: ${phraseCount}, grammar: ${grammarCount}, tense patterns: ${conjCount}`);
  console.log(`  schema version: ${LATEST_MIGRATION_VERSION}`);
});
