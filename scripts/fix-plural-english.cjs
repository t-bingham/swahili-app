/**
 * Transforms English fields like "bad child (plural)" → "bad children"
 * in the cards table of swahili_default.db.
 *
 * Skips pronoun entries that legitimately use "(plural)" as a grammatical
 * label (e.g. "you (plural)" for "ninyi").
 *
 * Run: node scripts/fix-plural-english.js
 */

const fs   = require('fs');
const path = require('path');
const pluralize = require('../node_modules/pluralize/pluralize.js');

// ── Extra irregular / edge-case overrides that pluralize misses ────────────
const OVERRIDES = {
  'loaf':        'loaves',
  'leaf':        'leaves',
  'wolf':        'wolves',
  'beef':        'beef',       // already plural-compatible
  'livestock':   'livestock',
  'greens':      'greens',
  'lips':        'lips',
  'luggage':     'luggage',
  'merchandise': 'merchandise',
  'police':      'police',
  'blood':       'blood',
  'sunshine':    'sunshine',
  'poetry':      'poetry',
  'pay':         'pay',
  'brightness':  'brightness',
  'amnesty':     'amnesty',
  'aid':         'aid',
  'mourning':    'mourning',
  'bereavement': 'bereavement',
};

// Words that should never be pluralized (prepositions, conjunctions, etc.)
const STOP_WORDS = new Set(['of', 'the', 'a', 'an', 'for', 'in', 'at', 'on',
  'to', 'with', 'from', 'by', 'and', 'or', 'etc.', 'one', 'large', 'medical',
  'romantic', 'physical', 'small', 'own', 'old', 'thick', 'printed', 'east',
  'african', 'currency', 'water', 'flatbread', 'bank', 'id', 'long', 'short',
]);

function pluralizeWord(word) {
  const low = word.toLowerCase();
  if (STOP_WORDS.has(low)) return word;
  if (OVERRIDES[low]) return OVERRIDES[low];
  // Preserve capitalisation
  const result = pluralize(low);
  return word[0] === word[0].toUpperCase() ? result[0].toUpperCase() + result.slice(1) : result;
}

/**
 * Pluralize a slash-separated segment, e.g.
 *   "arm / hand"        → "arms / hands"
 *   "bag / handbag"     → "bags / handbags"
 */
function pluralizeSegment(seg) {
  return seg
    .split(' / ')
    .map(part => pluralizePart(part.trim()))
    .join(' / ');
}

/**
 * Pluralize a single part, which may have a parenthetical qualifier:
 *   "child"                   → "children"
 *   "aunt (father's sister)"  → "aunts (father's sisters)"
 *   "card (bank, ID, etc.)"   → "cards (bank, ID, etc.)"
 *   "doctor (medical)"        → "doctors (medical)"
 */
function pluralizePart(part) {
  const parenMatch = part.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const mainWord  = parenMatch[1].trim();
    const qualifier = parenMatch[2].trim();
    return `${pluralizeWord(mainWord)} (${pluralizeQualifier(qualifier)})`;
  }
  return pluralizeWord(part);
}

/**
 * Pluralize the last meaningful noun in a qualifier string.
 * "father's sister"  → "father's sisters"
 * "medical"          → "medical"   (single adjective — unchanged)
 * "bank, ID, etc."   → "bank, ID, etc."  (list with etc — unchanged)
 * "of body"          → "of body"   (prep phrase — unchanged)
 */
function pluralizeQualifier(q) {
  // Contains "etc." or comma-separated abbreviations — leave alone
  if (q.includes('etc.') || (q.includes(',') && !q.includes("'s"))) return q;
  // Starts with preposition — leave alone
  if (/^(of|from|for|in|at|on|with|by)\b/i.test(q)) return q;
  // Single-word adjective/descriptor — leave alone
  if (!q.includes(' ') && STOP_WORDS.has(q.toLowerCase())) return q;

  // Possessive phrase like "father's sister" → "father's sisters"
  // or "mother's brother" → "mother's brothers"
  const possMatch = q.match(/^(.+'s)\s+(.+)$/);
  if (possMatch) {
    return `${possMatch[1]} ${pluralizeWord(possMatch[2])}`;
  }

  // Otherwise pluralize the last word
  const words = q.split(' ');
  words[words.length - 1] = pluralizeWord(words[words.length - 1]);
  return words.join(' ');
}

/**
 * Main transform: "bad child (plural)" → "bad children"
 * Returns null if the entry should be skipped.
 */
function transform(english) {
  if (!english.endsWith(' (plural)')) return null;
  const withoutMarker = english.slice(0, english.length - ' (plural)'.length);

  // Split off the first word (the adjective: bad / big / good/beautiful)
  const spaceIdx = withoutMarker.indexOf(' ');
  if (spaceIdx === -1) return null;

  const adjective  = withoutMarker.slice(0, spaceIdx);        // "bad"
  const nounPhrase = withoutMarker.slice(spaceIdx + 1).trim(); // "child"

  const pluralised = pluralizeSegment(nounPhrase);
  return `${adjective} ${pluralised}`;
}

// ── Main ──────────────────────────────────────────────────────────────────

const initSqlJs = require('../node_modules/sql.js/dist/sql-asm.js');
const DB_PATH   = path.join(__dirname, '..', 'public', 'swahili_default.db');

initSqlJs().then(SQL => {
  const buf = fs.readFileSync(DB_PATH);
  const db  = new SQL.Database(buf);

  const rows = db.exec(
    "SELECT id, english FROM cards WHERE english LIKE '%(plural)%' AND english NOT LIKE 'you%'"
  );

  let updated = 0, skipped = 0;
  const problems = [];

  db.run('BEGIN TRANSACTION');

  for (const [id, english] of rows[0].values) {
    const newEnglish = transform(english);
    if (!newEnglish) { skipped++; continue; }
    if (newEnglish === english) { skipped++; continue; }

    // Sanity: result should not still contain "(plural)"
    if (newEnglish.includes('(plural)')) {
      problems.push({ id, english, newEnglish });
      skipped++;
      continue;
    }

    db.run('UPDATE cards SET english = ? WHERE id = ?', [newEnglish, id]);
    updated++;
  }

  db.run('COMMIT');

  console.log(`Updated: ${updated} | Skipped/unchanged: ${skipped}`);

  if (problems.length) {
    console.warn('\nEntries that still contain "(plural)" after transform (NOT updated):');
    problems.forEach(p => console.warn(` ${p.id} | ${p.english} → ${p.newEnglish}`));
  }

  // Spot-check a few
  console.log('\nSpot-check:');
  const checks = db.exec(
    "SELECT english FROM cards WHERE id IN (" +
    "'gen-unit-01:adj:watoto:-baya','gen-unit-10:adj:mikono:-baya'," +
    "'gen-unit-04:adj:mashangazi:-baya','gen-unit-05:adj:matunda:-baya'," +
    "'gen-unit-22:adj:watoto:-kubwa','gen-unit-07:adj:madaktari:-kubwa')"
  );
  checks[0].values.forEach(r => console.log(' ', r[0]));

  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
  console.log('\nDatabase saved to', DB_PATH);
  db.close();
});
