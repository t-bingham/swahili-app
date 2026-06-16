/**
 * Builds public/korean_default.db — the Korean curriculum seed DB.
 *
 * Strategy (mirrors how the Swahili scripts treat swahili_default.db as the source of
 * truth): clone the exact app schema from swahili_default.db, add the same columns/tables
 * the runtime migration adds, wipe all content, then insert a curated Korean starter
 * curriculum. The DB ships at schema_migrations.version = LATEST so the app runs no
 * (Swahili-specific) migrations on it.
 *
 * Content is hand-curated and correct (Revised Romanization written by rule), NOT
 * mass-LLM-generated — the lesson from the Swahili review. Extend by editing the arrays
 * below and re-running:  node scripts/build-korean-db.cjs
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const initSqlJs = require(path.join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-asm.js'));

const LATEST_MIGRATION_VERSION = 2; // keep in sync with src/database/migrations.ts

// ─── Units ──────────────────────────────────────────────────────────────────
// [id, name, description, level, order_index, track, grammar_notes]
const UNITS = [
  ['ko-unit-01', 'First Words', 'Greetings and courtesy — the phrases you need on day one.', 1, 1, 'vocabulary', ''],
  ['ko-unit-02', 'Basics & Question Words', 'Pronouns and the who/what/where/when/why of Korean.', 1, 2, 'vocabulary', ''],
  ['ko-unit-03', 'Numbers (Sino-Korean)', 'The Sino-Korean number set, used for dates, money, and minutes.', 1, 3, 'vocabulary', ''],
  ['ko-unit-04', 'Everyday Phrases', 'High-value sentences for getting around.', 1, 4, 'vocabulary', ''],
  ['ko-unit-05', 'Food & Drink', 'Ordering and eating — the heart of Korean social life.', 1, 5, 'vocabulary', ''],
  ['ko-unit-06', 'Common Verbs & Adjectives', 'Dictionary forms plus their polite -요 endings.', 1, 6, 'vocabulary', ''],
  ['ko-unit-07', 'How Korean Works', 'Particles and speech levels — the grammar backbone.', 1, 7, 'grammar',
    'Korean marks roles with particles attached to nouns (topic 은/는, subject 이/가, object 을/를) and encodes politeness in the verb ending. Mastering these unlocks sentence-building.'],
];

// ─── Cards ──────────────────────────────────────────────────────────────────
// { id, ko, en, rom, type, unit, tags?, register?, pos?, note?, ex?:[ko,en] }
const REG = { N: 'neutral', F: 'formal', I: 'informal' };
const CARDS = [
  // Unit 1 — First Words
  { id: 'ko-greet-01', ko: '안녕하세요', en: 'hello', rom: 'annyeonghaseyo', type: 'phrase', unit: 'ko-unit-01', register: 'formal', pos: 'phrase',
    note: 'The standard polite greeting, used any time of day (literally "are you at peace?"). The casual form among close friends is 안녕.',
    ex: ['안녕하세요, 만나서 반갑습니다.', 'Hello, nice to meet you.'] },
  { id: 'ko-greet-02', ko: '안녕', en: 'hi / bye', rom: 'annyeong', type: 'phrase', unit: 'ko-unit-01', register: 'informal', pos: 'phrase',
    note: 'Casual (반말) — use only with close friends or people younger than you. To elders or strangers, always use 안녕하세요.' },
  { id: 'ko-greet-03', ko: '감사합니다', en: 'thank you', rom: 'gamsahamnida', type: 'phrase', unit: 'ko-unit-01', register: 'formal', pos: 'phrase',
    note: 'Formal "thank you". 고마워요 is a softer polite form; 고마워 is casual.' },
  { id: 'ko-greet-04', ko: '죄송합니다', en: "I'm sorry", rom: 'joesonghamnida', type: 'phrase', unit: 'ko-unit-01', register: 'formal', pos: 'phrase',
    note: 'Formal apology. 미안해요 is polite, 미안 is casual. Also used as "excuse me" to get attention politely.' },
  { id: 'ko-greet-05', ko: '안녕히 가세요', en: 'goodbye (to someone leaving)', rom: 'annyeonghi gaseyo', type: 'phrase', unit: 'ko-unit-01', register: 'formal', pos: 'phrase',
    note: 'Say this to the person who is LEAVING (literally "go in peace").' },
  { id: 'ko-greet-06', ko: '안녕히 계세요', en: 'goodbye (to someone staying)', rom: 'annyeonghi gyeseyo', type: 'phrase', unit: 'ko-unit-01', register: 'formal', pos: 'phrase',
    note: 'Say this to the person who is STAYING (literally "stay in peace"). Which one you use depends on who is going.' },
  { id: 'ko-greet-07', ko: '실례합니다', en: 'excuse me', rom: 'sillyehamnida', type: 'phrase', unit: 'ko-unit-01', register: 'formal', pos: 'phrase',
    note: 'Polite "excuse me" to pass by or interrupt.' },
  { id: 'ko-greet-08', ko: '만나서 반갑습니다', en: 'nice to meet you', rom: 'mannaseo bangapseumnida', type: 'phrase', unit: 'ko-unit-01', register: 'formal', pos: 'phrase' },
  { id: 'ko-greet-09', ko: '네', en: 'yes', rom: 'ne', type: 'vocabulary', unit: 'ko-unit-01', pos: 'interjection',
    note: 'Also used as "I see / uh-huh" to show you are listening. 예 (ye) is a more formal yes.' },
  { id: 'ko-greet-10', ko: '아니요', en: 'no', rom: 'aniyo', type: 'vocabulary', unit: 'ko-unit-01', pos: 'interjection' },

  // Unit 2 — Basics & Question Words
  { id: 'ko-basic-01', ko: '저', en: 'I / me (humble)', rom: 'jeo', type: 'vocabulary', unit: 'ko-unit-02', register: 'formal', pos: 'pronoun',
    note: 'The humble "I", used in polite speech. The casual equivalent is 나.' },
  { id: 'ko-basic-02', ko: '나', en: 'I / me (casual)', rom: 'na', type: 'vocabulary', unit: 'ko-unit-02', register: 'informal', pos: 'pronoun' },
  { id: 'ko-basic-03', ko: '당신', en: 'you', rom: 'dangsin', type: 'vocabulary', unit: 'ko-unit-02', pos: 'pronoun',
    note: 'Korean rarely uses a direct word for "you" — names, titles, or roles (선생님 "teacher", 사장님 "boss") are preferred. 당신 can sound confrontational between strangers.' },
  { id: 'ko-basic-04', ko: '이름', en: 'name', rom: 'ireum', type: 'vocabulary', unit: 'ko-unit-02', pos: 'noun',
    ex: ['이름이 뭐예요?', 'What is your name?'] },
  { id: 'ko-basic-05', ko: '무엇', en: 'what', rom: 'mueot', type: 'vocabulary', unit: 'ko-unit-02', pos: 'pronoun',
    note: 'In speech this usually contracts to 뭐 (mwo).' },
  { id: 'ko-basic-06', ko: '누구', en: 'who', rom: 'nugu', type: 'vocabulary', unit: 'ko-unit-02', pos: 'pronoun' },
  { id: 'ko-basic-07', ko: '어디', en: 'where', rom: 'eodi', type: 'vocabulary', unit: 'ko-unit-02', pos: 'pronoun' },
  { id: 'ko-basic-08', ko: '언제', en: 'when', rom: 'eonje', type: 'vocabulary', unit: 'ko-unit-02', pos: 'pronoun' },
  { id: 'ko-basic-09', ko: '왜', en: 'why', rom: 'wae', type: 'vocabulary', unit: 'ko-unit-02', pos: 'pronoun' },
  { id: 'ko-basic-10', ko: '어떻게', en: 'how', rom: 'eotteoke', type: 'vocabulary', unit: 'ko-unit-02', pos: 'adverb' },

  // Unit 3 — Numbers (Sino-Korean)
  { id: 'ko-num-01', ko: '일', en: 'one (1)', rom: 'il', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number',
    note: 'Sino-Korean numbers are used for dates, money, phone numbers, and minutes. A separate native Korean set (하나, 둘, 셋…) is used for counting objects, age, and the hour.' },
  { id: 'ko-num-02', ko: '이', en: 'two (2)', rom: 'i', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number' },
  { id: 'ko-num-03', ko: '삼', en: 'three (3)', rom: 'sam', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number' },
  { id: 'ko-num-04', ko: '사', en: 'four (4)', rom: 'sa', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number',
    note: 'The number 4 (사) sounds like the Sino-Korean word for "death", so it is sometimes avoided — buildings may skip a 4th floor (labelled "F").' },
  { id: 'ko-num-05', ko: '오', en: 'five (5)', rom: 'o', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number' },
  { id: 'ko-num-06', ko: '육', en: 'six (6)', rom: 'yuk', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number' },
  { id: 'ko-num-07', ko: '칠', en: 'seven (7)', rom: 'chil', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number' },
  { id: 'ko-num-08', ko: '팔', en: 'eight (8)', rom: 'pal', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number' },
  { id: 'ko-num-09', ko: '구', en: 'nine (9)', rom: 'gu', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number' },
  { id: 'ko-num-10', ko: '십', en: 'ten (10)', rom: 'sip', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number' },

  // Unit 4 — Everyday Phrases
  { id: 'ko-phr-01', ko: '얼마예요?', en: 'how much is it?', rom: 'eolmayeyo?', type: 'phrase', unit: 'ko-unit-04', register: 'formal', pos: 'phrase' },
  { id: 'ko-phr-02', ko: '화장실이 어디예요?', en: 'where is the bathroom?', rom: 'hwajangsiri eodiyeyo?', type: 'phrase', unit: 'ko-unit-04', register: 'formal', pos: 'phrase' },
  { id: 'ko-phr-03', ko: '도와주세요', en: 'please help me', rom: 'dowajuseyo', type: 'phrase', unit: 'ko-unit-04', register: 'formal', pos: 'phrase' },
  { id: 'ko-phr-04', ko: '잘 모르겠어요', en: "I don't know / I'm not sure", rom: 'jal moreugesseoyo', type: 'phrase', unit: 'ko-unit-04', register: 'formal', pos: 'phrase' },
  { id: 'ko-phr-05', ko: '천천히 말해 주세요', en: 'please speak slowly', rom: 'cheoncheonhi malhae juseyo', type: 'phrase', unit: 'ko-unit-04', register: 'formal', pos: 'phrase' },
  { id: 'ko-phr-06', ko: '영어 할 수 있어요?', en: 'can you speak English?', rom: 'yeongeo hal su isseoyo?', type: 'phrase', unit: 'ko-unit-04', register: 'formal', pos: 'phrase' },
  { id: 'ko-phr-07', ko: '괜찮아요', en: "it's okay / I'm fine", rom: 'gwaenchanayo', type: 'phrase', unit: 'ko-unit-04', register: 'formal', pos: 'phrase',
    note: 'Hugely versatile: "I\'m okay", "it\'s fine", or a polite "no thank you" when declining an offer.' },

  // Unit 5 — Food & Drink
  { id: 'ko-food-01', ko: '물', en: 'water', rom: 'mul', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun',
    ex: ['물 주세요.', 'Water, please.'] },
  { id: 'ko-food-02', ko: '밥', en: 'rice / meal', rom: 'bap', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun',
    note: '밥 is cooked rice and, by extension, "a meal". "밥 먹었어요?" ("have you eaten?") is a common way to show you care, not a literal question.' },
  { id: 'ko-food-03', ko: '김치', en: 'kimchi', rom: 'gimchi', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun',
    note: 'Fermented vegetables (usually napa cabbage with chili), served at almost every meal — the cornerstone of Korean cuisine.' },
  { id: 'ko-food-04', ko: '비빔밥', en: 'bibimbap (mixed rice)', rom: 'bibimbap', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun',
    note: 'Rice topped with vegetables, egg, and gochujang (chili paste), mixed together before eating. The name literally means "mixed rice".' },
  { id: 'ko-food-05', ko: '불고기', en: 'bulgogi (marinated beef)', rom: 'bulgogi', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun',
    note: 'Thin beef marinated in soy sauce, sugar, and pear, then grilled. Literally "fire meat".' },
  { id: 'ko-food-06', ko: '커피', en: 'coffee', rom: 'keopi', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun' },
  { id: 'ko-food-07', ko: '차', en: 'tea', rom: 'cha', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun' },
  { id: 'ko-food-08', ko: '맥주', en: 'beer', rom: 'maekju', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun' },
  { id: 'ko-food-09', ko: '메뉴', en: 'menu', rom: 'menyu', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun' },
  { id: 'ko-food-10', ko: '계산서', en: 'the bill / check', rom: 'gyesanseo', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun' },

  // Unit 6 — Common Verbs & Adjectives (dictionary form; note gives the polite -요 form)
  { id: 'ko-verb-01', ko: '가다', en: 'to go', rom: 'gada', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 가요 (gayo).' },
  { id: 'ko-verb-02', ko: '오다', en: 'to come', rom: 'oda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 와요 (wayo).' },
  { id: 'ko-verb-03', ko: '먹다', en: 'to eat', rom: 'meokda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 먹어요 (meogeoyo).' },
  { id: 'ko-verb-04', ko: '마시다', en: 'to drink', rom: 'masida', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 마셔요 (masyeoyo).' },
  { id: 'ko-verb-05', ko: '하다', en: 'to do', rom: 'hada', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 해요 (haeyo). 하다 attaches to many nouns to make verbs (공부하다 "to study").' },
  { id: 'ko-verb-06', ko: '있다', en: 'to exist / to have', rom: 'itda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 있어요 (isseoyo).' },
  { id: 'ko-verb-07', ko: '없다', en: 'to not exist / not have', rom: 'eopda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 없어요 (eopseoyo). The opposite of 있다.' },
  { id: 'ko-verb-08', ko: '좋다', en: 'to be good', rom: 'jota', type: 'vocabulary', unit: 'ko-unit-06', pos: 'adjective', note: 'Polite present: 좋아요 (joayo).' },
  { id: 'ko-verb-09', ko: '크다', en: 'to be big', rom: 'keuda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'adjective', note: 'Polite present: 커요 (keoyo).' },
  { id: 'ko-verb-10', ko: '작다', en: 'to be small', rom: 'jakda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'adjective', note: 'Polite present: 작아요 (jagayo).' },

  // Unit 7 — How Korean Works (grammar)
  { id: 'ko-gram-01', ko: '은 / 는', en: 'topic particle', rom: 'eun / neun', type: 'grammar', unit: 'ko-unit-07', pos: 'particle',
    note: 'Marks the topic of the sentence ("as for…"). Use 은 after a consonant, 는 after a vowel. 저는 = "as for me…".' },
  { id: 'ko-gram-02', ko: '이 / 가', en: 'subject particle', rom: 'i / ga', type: 'grammar', unit: 'ko-unit-07', pos: 'particle',
    note: 'Marks the grammatical subject (who/what does the action). Use 이 after a consonant, 가 after a vowel.' },
  { id: 'ko-gram-03', ko: '을 / 를', en: 'object particle', rom: 'eul / reul', type: 'grammar', unit: 'ko-unit-07', pos: 'particle',
    note: 'Marks the object (what the action is done to). Use 을 after a consonant, 를 after a vowel. 밥을 먹어요 = "(I) eat rice".' },
  { id: 'ko-gram-04', ko: '요', en: 'polite ending', rom: '-yo', type: 'grammar', unit: 'ko-unit-07', pos: 'particle',
    note: 'Attaching -요 to a verb makes speech polite (존댓말); dropping it makes it casual (반말). Speech level in Korean is grammar, not just tone — choosing the right one for your listener is essential.' },
];

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

  // 3) Insert Korean units.
  for (const [id, name, desc, level, order_index, track, notes] of UNITS) {
    db.run(
      `INSERT INTO units (id, name, description, level, order_index, prerequisite_ids, grammar_notes, estimated_hours, track)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, name, desc, level, order_index, '[]', notes, 1.0, track],
    );
  }

  // 4) Insert Korean cards + fresh card_states.
  let rank = 1;
  for (const c of CARDS) {
    const examples = c.ex ? JSON.stringify([{ swahili: c.ex[0], english: c.ex[1] }]) : '[]';
    db.run(
      `INSERT INTO cards
         (id, swahili, english, pronunciation, type, tags, noun_class, verb_root, conjugation_key,
          base_difficulty, frequency_rank, quick_learn, unit_id, source, prerequisite_card_id,
          example_sentences, register, morpheme_breakdown, part_of_speech, etymology, dialect,
          cultural_note, senses, placement_only)
       VALUES (?,?,?,?,?,?,NULL,NULL,NULL,?,?,?,?,'handwritten',NULL,?,?,NULL,?,NULL,'standard',?,?,0)`,
      [c.id, c.ko, c.en, c.rom, c.type, JSON.stringify(c.tags || []), 2.5, rank,
       c.type === 'phrase' ? 1 : 0, c.unit, examples, c.register || 'neutral', c.pos || null,
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

  // 5) Mark schema as fully migrated so the app runs no (Swahili) migrations on this DB.
  db.run(
    `INSERT INTO schema_migrations (id, version, applied_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET version = excluded.version, applied_at = excluded.applied_at`,
    [LATEST_MIGRATION_VERSION, new Date().toISOString()],
  );

  // 6) Reclaim the space freed by deleting all the Swahili content, then write it out.
  db.run('VACUUM');
  const out = path.join(ROOT, 'public', 'korean_default.db');
  fs.writeFileSync(out, Buffer.from(db.export()));
  const cardCount = db.exec('SELECT COUNT(*) FROM cards')[0].values[0][0];
  const unitCount = db.exec('SELECT COUNT(*) FROM units')[0].values[0][0];
  console.log(`Wrote ${out}`);
  console.log(`  units: ${unitCount}, cards: ${cardCount}, schema version: ${LATEST_MIGRATION_VERSION}`);
});
