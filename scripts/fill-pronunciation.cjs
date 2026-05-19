#!/usr/bin/env node
'use strict';
/**
 * scripts/fill-pronunciation.js
 *
 * Fills the `pronunciation` field in swahili_default.db using a rule-based
 * Swahili syllabifier. Covers vocabulary and conjugation cards.
 *
 * Swahili is highly phonemic with near-universal penultimate stress, so
 * this produces correct results for ~95%+ of words.
 *
 * Usage:
 *   node scripts/fill-pronunciation.js
 *
 * Prerequisites: run `npm install` inside web/ first.
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const DB_PATH   = path.join(ROOT, 'public', 'swahili_default.db');
const WEB_DB    = path.join(ROOT, 'web', 'public', 'swahili_default.db');
const SQLJS_DIR = path.join(ROOT, 'web', 'node_modules', 'sql.js');

// ─── Rule-based Swahili syllabifier ──────────────────────────────────────────

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

// Longer clusters listed first so they match before their sub-strings.
const CLUSTERS = [
  "ng'", 'ny', 'sh', 'ch', 'dh', 'gh', 'kh', 'th',
  'mb',  'nd', 'nj', 'nk', 'nt', 'nz', 'mv',
];

function syllabify(word) {
  const w = word.toLowerCase();
  const syllables = [];
  let i = 0;

  while (i < w.length) {
    let syl = '';

    // Gather leading consonant(s), respecting multi-char clusters.
    while (i < w.length && !VOWELS.has(w[i])) {
      let matched = false;
      for (const cl of CLUSTERS) {
        if (w.startsWith(cl, i)) {
          syl += cl;
          i   += cl.length;
          matched = true;
          break;
        }
      }
      if (!matched) syl += w[i++];
    }

    // Gather the vowel nucleus.
    if (i < w.length && VOWELS.has(w[i])) syl += w[i++];

    if (syl) syllables.push(syl);
  }

  if (!syllables.length) return word;

  // Penultimate stress — the standard Swahili rule.
  const stressAt = syllables.length >= 2 ? syllables.length - 2 : 0;
  return syllables
    .map((s, idx) => (idx === stressAt ? s.toUpperCase() : s))
    .join('-');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const initSqlJs = require(path.join(SQLJS_DIR, 'dist', 'sql-wasm.js'));
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(SQLJS_DIR, 'dist', file),
  });

  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  const result = db.exec(`
    SELECT DISTINCT swahili FROM cards
    WHERE  swahili NOT LIKE '% %'
    AND    type IN ('vocabulary', 'conjugation')
    AND    (pronunciation IS NULL OR pronunciation = '')
    ORDER  BY swahili
  `);
  const words = result[0]?.values.map((r) => r[0]) ?? [];

  console.log(`Filling pronunciation for ${words.length} distinct words...`);

  for (const word of words) {
    db.run(
      `UPDATE cards SET pronunciation = ?
       WHERE  swahili = ?
       AND    type IN ('vocabulary', 'conjugation')
       AND    (pronunciation IS NULL OR pronunciation = '')`,
      [syllabify(word), word],
    );
  }

  const outBuf = Buffer.from(db.export());
  fs.writeFileSync(DB_PATH, outBuf);
  console.log(`✓  Saved → ${DB_PATH}`);

  if (fs.existsSync(WEB_DB)) {
    fs.writeFileSync(WEB_DB, outBuf);
    console.log(`✓  Saved → ${WEB_DB}`);
  }

  console.log('Done!');
}

main().catch((err) => { console.error(err); process.exit(1); });
