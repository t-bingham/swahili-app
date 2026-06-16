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
  ['ko-unit-08', 'Native Korean Numbers', 'The native number set, used for counting things, people, age, and the hour.', 1, 4, 'vocabulary', ''],
  ['ko-unit-04', 'Everyday Phrases', 'High-value sentences for getting around.', 1, 5, 'vocabulary', ''],
  ['ko-unit-05', 'Food & Drink', 'Ordering and eating — the heart of Korean social life.', 1, 6, 'vocabulary', ''],
  ['ko-unit-09', 'Dining & Etiquette', 'The phrases and customs around a Korean meal — gratitude, toasting, sharing.', 1, 7, 'vocabulary', ''],
  ['ko-unit-06', 'Common Verbs & Adjectives', 'Dictionary forms plus their polite -요 endings.', 1, 8, 'vocabulary', ''],
  ['ko-unit-10', 'Family & Address Terms', 'How Koreans address each other by age, gender, and relationship — core to the culture.', 1, 9, 'vocabulary', ''],
  ['ko-unit-11', 'Time & Days', 'Talking about when — today, now, mornings, and the clock.', 1, 10, 'vocabulary', ''],
  ['ko-unit-12', 'Places & Getting Around', 'Everyday places and destinations.', 1, 11, 'vocabulary', ''],
  ['ko-unit-13', 'Cultural Concepts', 'Words that carry uniquely Korean meaning — often untranslatable. The heart of the culture.', 2, 12, 'vocabulary', ''],
  ['ko-unit-14', 'Holidays & Traditions', 'Festivals, rituals, and the customs that mark the Korean year.', 2, 13, 'vocabulary', ''],
  ['ko-unit-07', 'How Korean Works', 'Particles and speech levels — the grammar backbone.', 1, 14, 'grammar',
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
  { id: 'ko-gram-05', ko: '에', en: 'to / at (place or time)', rom: '-e', type: 'grammar', unit: 'ko-unit-07', pos: 'particle',
    note: 'Marks a destination or a point in time: 학교에 가요 (go TO school), 세 시에 (AT 3 o\'clock).' },
  { id: 'ko-gram-06', ko: '에서', en: 'at / from (where an action happens)', rom: '-eseo', type: 'grammar', unit: 'ko-unit-07', pos: 'particle',
    note: 'Marks where an action takes place or an origin: 집에서 먹어요 (eat AT home). Contrast with 에, which marks a destination.' },
  { id: 'ko-gram-07', ko: '도', en: 'also / too', rom: '-do', type: 'grammar', unit: 'ko-unit-07', pos: 'particle',
    note: 'Replaces the topic/subject particle to mean "also": 저도 = "me too".' },
  { id: 'ko-gram-08', ko: '의', en: "'s (possessive)", rom: '-ui', type: 'grammar', unit: 'ko-unit-07', pos: 'particle',
    note: "Marks possession: 친구의 책 (friend's book). Often dropped in casual speech. Here 의 is pronounced like 에 (e)." },

  // ── Unit 1 additions — First Words ──────────────────────────────────────────
  { id: 'ko-greet-11', ko: '여보세요', en: 'hello (on the phone)', rom: 'yeoboseyo', type: 'phrase', unit: 'ko-unit-01', register: 'formal', pos: 'phrase',
    note: 'Used only when answering or speaking on the phone — not face to face.' },
  { id: 'ko-greet-12', ko: '잠시만요', en: 'just a moment / excuse me', rom: 'jamsimanyo', type: 'phrase', unit: 'ko-unit-01', register: 'formal', pos: 'phrase',
    note: 'To ask someone to wait a second, or to squeeze past.' },
  { id: 'ko-greet-13', ko: '환영합니다', en: 'welcome', rom: 'hwanyeonghamnida', type: 'phrase', unit: 'ko-unit-01', register: 'formal', pos: 'phrase' },

  // ── Unit 2 additions — Basics ───────────────────────────────────────────────
  { id: 'ko-basic-11', ko: '예', en: 'yes (formal)', rom: 'ye', type: 'vocabulary', unit: 'ko-unit-02', register: 'formal', pos: 'interjection',
    note: 'A more formal "yes" than 네; both are common.' },
  { id: 'ko-basic-12', ko: '응', en: 'yeah (casual)', rom: 'eung', type: 'vocabulary', unit: 'ko-unit-02', register: 'informal', pos: 'interjection',
    note: 'Casual "yes/yeah" (반말) — only with close friends or juniors.' },
  { id: 'ko-basic-13', ko: '이것', en: 'this (thing)', rom: 'igeot', type: 'vocabulary', unit: 'ko-unit-02', pos: 'pronoun', note: 'Often shortened to 이거 in speech.' },
  { id: 'ko-basic-14', ko: '그것', en: 'that (thing)', rom: 'geugeot', type: 'vocabulary', unit: 'ko-unit-02', pos: 'pronoun', note: 'Often shortened to 그거.' },
  { id: 'ko-basic-15', ko: '저것', en: 'that one over there', rom: 'jeogeot', type: 'vocabulary', unit: 'ko-unit-02', pos: 'pronoun', note: 'Often shortened to 저거. Korean has three "that"s by distance: 이/그/저.' },

  // ── Unit 3 additions — Sino-Korean numbers ──────────────────────────────────
  { id: 'ko-num-11', ko: '백', en: 'hundred (100)', rom: 'baek', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number' },
  { id: 'ko-num-12', ko: '천', en: 'thousand (1,000)', rom: 'cheon', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number' },
  { id: 'ko-num-13', ko: '만', en: 'ten thousand (10,000)', rom: 'man', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number',
    note: 'Korean groups large numbers by 만 (10,000), not by thousands — so 100,000 is 십만 ("ten ten-thousands").' },
  { id: 'ko-num-14', ko: '영', en: 'zero', rom: 'yeong', type: 'vocabulary', unit: 'ko-unit-03', pos: 'number',
    note: 'Zero is 영 (yeong) or 공 (gong) — 공 is common for phone numbers.' },

  // ── Unit 8 — Native Korean Numbers ──────────────────────────────────────────
  { id: 'ko-nnum-01', ko: '하나', en: 'one (1)', rom: 'hana', type: 'vocabulary', unit: 'ko-unit-08', pos: 'number',
    note: 'Native Korean numbers count things, people, age, and the hour. (Sino-Korean is for dates, money, and minutes.) Before a counter, 하나→한, 둘→두, 셋→세, 넷→네.' },
  { id: 'ko-nnum-02', ko: '둘', en: 'two (2)', rom: 'dul', type: 'vocabulary', unit: 'ko-unit-08', pos: 'number' },
  { id: 'ko-nnum-03', ko: '셋', en: 'three (3)', rom: 'set', type: 'vocabulary', unit: 'ko-unit-08', pos: 'number' },
  { id: 'ko-nnum-04', ko: '넷', en: 'four (4)', rom: 'net', type: 'vocabulary', unit: 'ko-unit-08', pos: 'number' },
  { id: 'ko-nnum-05', ko: '다섯', en: 'five (5)', rom: 'daseot', type: 'vocabulary', unit: 'ko-unit-08', pos: 'number' },
  { id: 'ko-nnum-06', ko: '여섯', en: 'six (6)', rom: 'yeoseot', type: 'vocabulary', unit: 'ko-unit-08', pos: 'number' },
  { id: 'ko-nnum-07', ko: '일곱', en: 'seven (7)', rom: 'ilgop', type: 'vocabulary', unit: 'ko-unit-08', pos: 'number' },
  { id: 'ko-nnum-08', ko: '여덟', en: 'eight (8)', rom: 'yeodeol', type: 'vocabulary', unit: 'ko-unit-08', pos: 'number' },
  { id: 'ko-nnum-09', ko: '아홉', en: 'nine (9)', rom: 'ahop', type: 'vocabulary', unit: 'ko-unit-08', pos: 'number' },
  { id: 'ko-nnum-10', ko: '열', en: 'ten (10)', rom: 'yeol', type: 'vocabulary', unit: 'ko-unit-08', pos: 'number' },
  { id: 'ko-nnum-11', ko: '살', en: 'years old (age counter)', rom: 'sal', type: 'vocabulary', unit: 'ko-unit-08', pos: 'counter',
    note: 'Used with native numbers for age: 스무 살 = 20 years old. Age carries real social weight in Korea — it sets how people address each other.' },

  // ── Unit 4 additions — Everyday Phrases ─────────────────────────────────────
  { id: 'ko-phr-08', ko: '이거 주세요', en: 'this one, please', rom: 'igeo juseyo', type: 'phrase', unit: 'ko-unit-04', register: 'formal', pos: 'phrase',
    note: 'Point at what you want and say it — works in shops and restaurants.' },
  { id: 'ko-phr-09', ko: '여기요', en: 'excuse me! (calling a server)', rom: 'yeogiyo', type: 'phrase', unit: 'ko-unit-04', pos: 'phrase',
    note: 'How you get a server\'s attention in a restaurant — say 여기요! or 저기요!. Perfectly polite and expected.' },
  { id: 'ko-phr-10', ko: '얼마나 걸려요?', en: 'how long does it take?', rom: 'eolmana geollyeoyo?', type: 'phrase', unit: 'ko-unit-04', register: 'formal', pos: 'phrase' },
  { id: 'ko-phr-11', ko: '다시 한 번 말해 주세요', en: 'please say that again', rom: 'dasi han beon malhae juseyo', type: 'phrase', unit: 'ko-unit-04', register: 'formal', pos: 'phrase' },

  // ── Unit 5 additions — Food & Drink ─────────────────────────────────────────
  { id: 'ko-food-11', ko: '소주', en: 'soju', rom: 'soju', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun',
    note: 'Korea\'s iconic clear distilled spirit, central to social drinking. Etiquette: pour for others (never yourself), and hold the bottle with two hands for elders.' },
  { id: 'ko-food-12', ko: '라면', en: 'ramyeon (instant noodles)', rom: 'ramyeon', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun',
    note: 'Korean instant noodles — typically spicy. A culture unto itself; "라면 먹을래요?" can even be a flirtatious invitation.' },
  { id: 'ko-food-13', ko: '떡볶이', en: 'tteokbokki (spicy rice cakes)', rom: 'tteokbokki', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun',
    note: 'Beloved street food: chewy rice cakes in a sweet-and-spicy gochujang sauce.' },
  { id: 'ko-food-14', ko: '치킨', en: 'fried chicken', rom: 'chikin', type: 'vocabulary', unit: 'ko-unit-05', pos: 'noun',
    note: '"치맥" (chimaek = chicken + 맥주 beer) is a national pastime — fried chicken and beer with friends.' },

  // ── Unit 9 — Dining & Etiquette (cultural) ──────────────────────────────────
  { id: 'ko-dine-01', ko: '잘 먹겠습니다', en: '"I will eat well" (before a meal)', rom: 'jal meokgesseumnida', type: 'phrase', unit: 'ko-unit-09', register: 'formal', pos: 'phrase', tags: ['culture'],
    note: 'Said before eating to thank whoever cooked or is paying — a small ritual of gratitude with no direct English equivalent.' },
  { id: 'ko-dine-02', ko: '잘 먹었습니다', en: '"I ate well" (after a meal)', rom: 'jal meogeotseumnida', type: 'phrase', unit: 'ko-unit-09', register: 'formal', pos: 'phrase', tags: ['culture'],
    note: 'Said after the meal to thank the host or cook. Leaving it out can come across as ungrateful.' },
  { id: 'ko-dine-03', ko: '건배', en: 'cheers! (a toast)', rom: 'geonbae', type: 'phrase', unit: 'ko-unit-09', pos: 'phrase', tags: ['culture'],
    note: 'Literally "empty glass". Drinking etiquette runs deep: pour for others, receive with two hands, and turn your head away when drinking in front of elders.' },
  { id: 'ko-dine-04', ko: '맛집', en: 'a great restaurant ("tasty place")', rom: 'matjip', type: 'vocabulary', unit: 'ko-unit-09', pos: 'noun', tags: ['culture'],
    note: 'A famous, must-try eatery. Hunting down 맛집 is a genuine national hobby.' },
  { id: 'ko-dine-05', ko: '회식', en: 'company dinner', rom: 'hoesik', type: 'vocabulary', unit: 'ko-unit-09', pos: 'noun', tags: ['culture'],
    note: 'After-work team dinners (often with drinking) — a major part of Korean work culture and bonding, sometimes felt as an obligation.' },
  { id: 'ko-dine-06', ko: '반찬', en: 'side dishes', rom: 'banchan', type: 'vocabulary', unit: 'ko-unit-09', pos: 'noun', tags: ['culture'],
    note: 'The small shared side dishes (kimchi, seasoned vegetables, etc.) served free with a Korean meal — and refilled on request.' },
  { id: 'ko-dine-07', ko: '식사하셨어요?', en: '"have you eaten?"', rom: 'siksahasyeosseoyo?', type: 'phrase', unit: 'ko-unit-09', register: 'formal', pos: 'phrase', tags: ['culture'],
    note: 'A warm everyday greeting expressing care, not a literal question — much like "how are you?".' },
  { id: 'ko-dine-08', ko: '맛있게 드세요', en: 'enjoy your meal', rom: 'masitge deuseyo', type: 'phrase', unit: 'ko-unit-09', register: 'formal', pos: 'phrase',
    note: 'Said by a host or server — literally "eat deliciously".' },

  // ── Unit 6 additions — Common Verbs & Adjectives ────────────────────────────
  { id: 'ko-verb-11', ko: '보다', en: 'to see / watch', rom: 'boda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 봐요 (bwayo).' },
  { id: 'ko-verb-12', ko: '사다', en: 'to buy', rom: 'sada', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 사요 (sayo).' },
  { id: 'ko-verb-13', ko: '자다', en: 'to sleep', rom: 'jada', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 자요 (jayo).' },
  { id: 'ko-verb-14', ko: '주다', en: 'to give', rom: 'juda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 줘요 (jwoyo). -아/어 주세요 means "please do (for me)".' },
  { id: 'ko-verb-15', ko: '알다', en: 'to know', rom: 'alda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 알아요 (arayo).' },
  { id: 'ko-verb-16', ko: '모르다', en: "to not know", rom: 'moreuda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 몰라요 (mollayo). The opposite of 알다.' },
  { id: 'ko-verb-17', ko: '좋아하다', en: 'to like', rom: 'joahada', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 좋아해요 (joahaeyo). (Note: 좋다 "to be good" is a feeling/state; 좋아하다 is the action of liking.)' },
  { id: 'ko-verb-18', ko: '사랑하다', en: 'to love', rom: 'saranghada', type: 'vocabulary', unit: 'ko-unit-06', pos: 'verb', note: 'Polite present: 사랑해요 (saranghaeyo). Casual: 사랑해.' },
  { id: 'ko-verb-19', ko: '예쁘다', en: 'to be pretty', rom: 'yeppeuda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'adjective', note: 'Polite present: 예뻐요 (yeppeoyo).' },
  { id: 'ko-verb-20', ko: '맛있다', en: 'to be delicious', rom: 'masitda', type: 'vocabulary', unit: 'ko-unit-06', pos: 'adjective', note: 'Polite present: 맛있어요 (masisseoyo).' },

  // ── Unit 10 — Family & Address Terms (cultural) ─────────────────────────────
  { id: 'ko-fam-01', ko: '엄마', en: 'mom', rom: 'eomma', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun' },
  { id: 'ko-fam-02', ko: '아빠', en: 'dad', rom: 'appa', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun' },
  { id: 'ko-fam-03', ko: '어머니', en: 'mother (formal)', rom: 'eomeoni', type: 'vocabulary', unit: 'ko-unit-10', register: 'formal', pos: 'noun' },
  { id: 'ko-fam-04', ko: '아버지', en: 'father (formal)', rom: 'abeoji', type: 'vocabulary', unit: 'ko-unit-10', register: 'formal', pos: 'noun' },
  { id: 'ko-fam-05', ko: '오빠', en: "older brother (woman speaking)", rom: 'oppa', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun', tags: ['culture'],
    note: 'A female uses 오빠 for an older brother — but also for an older male friend or boyfriend. It carries warmth and closeness, and is everywhere in K-pop and dramas.' },
  { id: 'ko-fam-06', ko: '형', en: 'older brother (man speaking)', rom: 'hyeong', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun', tags: ['culture'],
    note: 'A male uses 형 for an older brother or older male friend. Which sibling word you use depends on YOUR gender.' },
  { id: 'ko-fam-07', ko: '언니', en: 'older sister (woman speaking)', rom: 'eonni', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun', tags: ['culture'],
    note: 'A female uses 언니 for an older sister — also a friendly term for an older woman (e.g. a shop owner).' },
  { id: 'ko-fam-08', ko: '누나', en: 'older sister (man speaking)', rom: 'nuna', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun', tags: ['culture'],
    note: 'A male uses 누나 for an older sister or older female friend.' },
  { id: 'ko-fam-09', ko: '동생', en: 'younger sibling', rom: 'dongsaeng', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun',
    note: 'Younger brother or sister. Specify with 남동생 (younger brother) / 여동생 (younger sister).' },
  { id: 'ko-fam-10', ko: '할머니', en: 'grandmother', rom: 'halmeoni', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun', tags: ['culture'],
    note: 'Also a warm, respectful way to address any elderly woman.' },
  { id: 'ko-fam-11', ko: '할아버지', en: 'grandfather', rom: 'harabeoji', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun', tags: ['culture'] },
  { id: 'ko-fam-12', ko: '선배', en: 'senior (school/work)', rom: 'seonbae', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun', tags: ['culture'],
    note: 'Someone ahead of you at school or work. The 선배–후배 bond carries real obligations: seniors mentor and often pay; juniors show respect.' },
  { id: 'ko-fam-13', ko: '후배', en: 'junior (school/work)', rom: 'hubae', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun', tags: ['culture'],
    note: 'Someone behind you at school or work — the counterpart to 선배.' },
  { id: 'ko-fam-14', ko: '아줌마', en: 'middle-aged woman ("auntie")', rom: 'ajumma', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun', tags: ['culture'],
    note: 'Friendly address for a middle-aged/married woman, but can offend if she feels too young for it — in shops, 사장님 ("boss") or 여기요 is safer.' },
  { id: 'ko-fam-15', ko: '아저씨', en: 'middle-aged man ("mister")', rom: 'ajeossi', type: 'vocabulary', unit: 'ko-unit-10', pos: 'noun', tags: ['culture'] },

  // ── Unit 11 — Time & Days ───────────────────────────────────────────────────
  { id: 'ko-time-01', ko: '오늘', en: 'today', rom: 'oneul', type: 'vocabulary', unit: 'ko-unit-11', pos: 'noun' },
  { id: 'ko-time-02', ko: '내일', en: 'tomorrow', rom: 'naeil', type: 'vocabulary', unit: 'ko-unit-11', pos: 'noun' },
  { id: 'ko-time-03', ko: '어제', en: 'yesterday', rom: 'eoje', type: 'vocabulary', unit: 'ko-unit-11', pos: 'noun' },
  { id: 'ko-time-04', ko: '지금', en: 'now', rom: 'jigeum', type: 'vocabulary', unit: 'ko-unit-11', pos: 'adverb' },
  { id: 'ko-time-05', ko: '아침', en: 'morning / breakfast', rom: 'achim', type: 'vocabulary', unit: 'ko-unit-11', pos: 'noun' },
  { id: 'ko-time-06', ko: '점심', en: 'noon / lunch', rom: 'jeomsim', type: 'vocabulary', unit: 'ko-unit-11', pos: 'noun' },
  { id: 'ko-time-07', ko: '저녁', en: 'evening / dinner', rom: 'jeonyeok', type: 'vocabulary', unit: 'ko-unit-11', pos: 'noun' },
  { id: 'ko-time-08', ko: '밤', en: 'night', rom: 'bam', type: 'vocabulary', unit: 'ko-unit-11', pos: 'noun' },
  { id: 'ko-time-09', ko: '시', en: "o'clock (hour)", rom: 'si', type: 'vocabulary', unit: 'ko-unit-11', pos: 'counter', note: 'Hours use NATIVE numbers: 세 시 = 3 o\'clock.' },
  { id: 'ko-time-10', ko: '분', en: 'minute', rom: 'bun', type: 'vocabulary', unit: 'ko-unit-11', pos: 'counter', note: 'Minutes use SINO-Korean numbers: 삼십 분 = 30 minutes.' },
  { id: 'ko-time-11', ko: '요일', en: 'day of the week', rom: 'yoil', type: 'vocabulary', unit: 'ko-unit-11', pos: 'noun', note: 'e.g. 월요일 (Monday), 일요일 (Sunday).' },
  { id: 'ko-time-12', ko: '주말', en: 'weekend', rom: 'jumal', type: 'vocabulary', unit: 'ko-unit-11', pos: 'noun' },

  // ── Unit 12 — Places & Getting Around ───────────────────────────────────────
  { id: 'ko-place-01', ko: '집', en: 'house / home', rom: 'jip', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun' },
  { id: 'ko-place-02', ko: '학교', en: 'school', rom: 'hakgyo', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun' },
  { id: 'ko-place-03', ko: '회사', en: 'company / office', rom: 'hoesa', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun' },
  { id: 'ko-place-04', ko: '식당', en: 'restaurant', rom: 'sikdang', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun' },
  { id: 'ko-place-05', ko: '카페', en: 'cafe', rom: 'kape', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun' },
  { id: 'ko-place-06', ko: '화장실', en: 'bathroom / toilet', rom: 'hwajangsil', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun' },
  { id: 'ko-place-07', ko: '병원', en: 'hospital / clinic', rom: 'byeongwon', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun' },
  { id: 'ko-place-08', ko: '약국', en: 'pharmacy', rom: 'yakguk', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun' },
  { id: 'ko-place-09', ko: '역', en: 'station (train/subway)', rom: 'yeok', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun' },
  { id: 'ko-place-10', ko: '공항', en: 'airport', rom: 'gonghang', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun' },
  { id: 'ko-place-11', ko: '시장', en: 'market', rom: 'sijang', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun' },
  { id: 'ko-place-12', ko: '편의점', en: 'convenience store', rom: 'pyeonuijeom', type: 'vocabulary', unit: 'ko-unit-12', pos: 'noun', tags: ['culture'],
    note: 'Convenience stores (GS25, CU, 7-Eleven) are everywhere, open 24/7, and central to daily life — meals, banking, parcels, and more.' },

  // ── Unit 13 — Cultural Concepts (the heart of the culture) ───────────────────
  { id: 'ko-cult-01', ko: '정', en: 'deep bond / affection', rom: 'jeong', type: 'vocabulary', unit: 'ko-unit-13', pos: 'noun', tags: ['culture'],
    note: 'A uniquely Korean concept with no English equivalent: the deep emotional attachment, loyalty, and warmth that grows between people (and even places) over time. It is what makes you feel connected and unable to let go.' },
  { id: 'ko-cult-02', ko: '한', en: 'deep sorrow & endurance', rom: 'han', type: 'vocabulary', unit: 'ko-unit-13', pos: 'noun', tags: ['culture'],
    note: 'A hard-to-translate collective feeling of accumulated grief, sorrow, and resentment — and the quiet resilience born from it. Often described as central to the Korean soul and its arts.' },
  { id: 'ko-cult-03', ko: '눈치', en: 'social awareness ("reading the room")', rom: 'nunchi', type: 'vocabulary', unit: 'ko-unit-13', pos: 'noun', tags: ['culture'],
    note: 'The subtle art of sensing others\' feelings and unspoken needs. "눈치가 빠르다" (quick nunchi) is high praise; "눈치가 없다" (no nunchi) means socially clueless.' },
  { id: 'ko-cult-04', ko: '우리', en: 'we / our', rom: 'uri', type: 'vocabulary', unit: 'ko-unit-13', pos: 'pronoun', tags: ['culture'],
    note: 'Koreans say 우리 ("our") where English says "my": 우리 나라 (our country), 우리 엄마 (our mom), 우리 집 (our home). It reflects a deeply collective, group-first worldview.' },
  { id: 'ko-cult-05', ko: '효', en: 'filial piety', rom: 'hyo', type: 'vocabulary', unit: 'ko-unit-13', pos: 'noun', tags: ['culture'],
    note: 'The Confucian duty to respect, honour, and care for one\'s parents and elders — a foundational value that shapes family life and the entire honorific system of the language.' },
  { id: 'ko-cult-06', ko: '정성', en: 'sincerity / wholehearted devotion', rom: 'jeongseong', type: 'vocabulary', unit: 'ko-unit-13', pos: 'noun', tags: ['culture'],
    note: 'The heart and care poured into something — a home-cooked meal, a gift, a task. To do something 정성껏 ("with jeongseong") is to do it with your whole heart.' },
  { id: 'ko-cult-07', ko: '화이팅', en: '"you can do it!"', rom: 'hwaiting', type: 'phrase', unit: 'ko-unit-13', pos: 'interjection', tags: ['culture'],
    note: 'From English "fighting" — a ubiquitous cheer of encouragement and solidarity before exams, games, or any challenge. Also spelled/said 파이팅 (paiting).' },
  { id: 'ko-cult-08', ko: '수고하셨습니다', en: '"thank you for your hard work"', rom: 'sugohasyeotseumnida', type: 'phrase', unit: 'ko-unit-13', register: 'formal', pos: 'phrase', tags: ['culture'],
    note: 'Said to acknowledge someone\'s effort at the end of a task or workday — a core courtesy with no neat English equivalent. Casual: 수고했어.' },
  { id: 'ko-cult-09', ko: '아이고', en: '"oh dear / oh my"', rom: 'aigo', type: 'phrase', unit: 'ko-unit-13', pos: 'interjection', tags: ['culture'],
    note: 'An all-purpose exclamation of surprise, dismay, sympathy, or weariness — heard constantly, especially from older speakers.' },
  { id: 'ko-cult-10', ko: '대박', en: '"awesome! / jackpot!"', rom: 'daebak', type: 'phrase', unit: 'ko-unit-13', register: 'informal', pos: 'interjection', tags: ['culture'],
    note: 'Slang for something amazing or unbelievable — good or bad. "대박!" = "No way! / Awesome!".' },
  { id: 'ko-cult-11', ko: '애교', en: 'cute charm', rom: 'aegyo', type: 'vocabulary', unit: 'ko-unit-13', pos: 'noun', tags: ['culture'],
    note: 'Deliberately cute, endearing behaviour — voice, expressions, gestures — used to charm or to soften a request. A recognized part of social and pop culture.' },
  { id: 'ko-cult-12', ko: '빨리빨리', en: '"hurry, hurry"', rom: 'ppalli ppalli', type: 'phrase', unit: 'ko-unit-13', pos: 'adverb', tags: ['culture'],
    note: 'So common it names a cultural trait: Korea\'s fast-paced, get-it-done-now tempo — same-day everything, lightning delivery, quick decisions.' },

  // ── Unit 14 — Holidays & Traditions ─────────────────────────────────────────
  { id: 'ko-hol-01', ko: '설날', en: 'Lunar New Year', rom: 'seollal', type: 'vocabulary', unit: 'ko-unit-14', pos: 'noun', tags: ['culture'],
    note: 'The most important traditional holiday. Families gather, the young perform 세배 (deep bows) to elders, and everyone eats 떡국 — eating it traditionally adds a year to your age.' },
  { id: 'ko-hol-02', ko: '추석', en: 'Korean harvest festival', rom: 'chuseok', type: 'vocabulary', unit: 'ko-unit-14', pos: 'noun', tags: ['culture'],
    note: 'Often called "Korean Thanksgiving" — a major autumn holiday honouring ancestors. Families share 송편 (half-moon rice cakes) and visit ancestral graves.' },
  { id: 'ko-hol-03', ko: '세배', en: 'formal New Year bow', rom: 'sebae', type: 'vocabulary', unit: 'ko-unit-14', pos: 'noun', tags: ['culture'],
    note: 'A deep bow the young give elders at 설날 to wish them well. Elders reply with blessings and 세뱃돈 (gift money).' },
  { id: 'ko-hol-04', ko: '한복', en: 'traditional Korean dress', rom: 'hanbok', type: 'vocabulary', unit: 'ko-unit-14', pos: 'noun', tags: ['culture'],
    note: 'Worn on holidays and special occasions, known for its vivid colours and graceful curved lines.' },
  { id: 'ko-hol-05', ko: '떡', en: 'rice cake', rom: 'tteok', type: 'vocabulary', unit: 'ko-unit-14', pos: 'noun', tags: ['culture'],
    note: 'Chewy rice cakes eaten year-round and at celebrations. 떡국 (rice-cake soup) marks the New Year.' },
  { id: 'ko-hol-06', ko: '돌잔치', en: 'first-birthday celebration', rom: 'doljanchi', type: 'vocabulary', unit: 'ko-unit-14', pos: 'noun', tags: ['culture'],
    note: 'A big party for a baby\'s first birthday. In the 돌잡이, the baby picks an object said to foretell their future (money, a pencil, thread for long life…).' },
  { id: 'ko-hol-07', ko: '김장', en: 'communal kimchi-making', rom: 'gimjang', type: 'vocabulary', unit: 'ko-unit-14', pos: 'noun', tags: ['culture'],
    note: 'The late-autumn tradition of making big batches of kimchi for winter, often with family and neighbours. UNESCO recognizes it as intangible cultural heritage.' },
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
