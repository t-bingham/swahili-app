#!/usr/bin/env node
'use strict';
/**
 * scripts/fix-grammar-content.cjs
 *
 * Phase 0 curriculum correctness fixes for swahili_default.db.
 * Corrects systematic errors in machine-generated grammar cards:
 *
 *   P0.1  Negative conjugations (neg_present -a→-i; neg_past -ku-; neg_perfect -ja-)
 *   P0.3  Monosyllabic subjunctive (akule→ale, akuje→aje); object-infix monosyllabic (ananikula→ananila)
 *   P0.2  Adjective–noun concord (N-class nasal assimilation removes non-words nbaya/nkubwa;
 *         animacy override; class-5 zero prefix; correct number agreement)
 *   P0.4  ndio→ndiyo; remove exact-duplicate rows
 *
 * The corrected forms are REGENERATED from morphological components
 * (verb_root + conjugation_key for verbs; noun + noun_class + stem for adjectives)
 * rather than patched from the wrong strings, which keeps the fix deterministic
 * and idempotent.
 *
 * Usage:
 *   node scripts/fix-grammar-content.cjs --dry     # preview, no write
 *   node scripts/fix-grammar-content.cjs           # apply + save
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'public', 'swahili_default.db');
const DRY = process.argv.includes('--dry');

// ─── Swahili syllabifier (identical to scripts/fill-pronunciation.cjs) ──────────
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const CLUSTERS = ["ng'", 'ny', 'sh', 'ch', 'dh', 'gh', 'kh', 'th', 'mb', 'nd', 'nj', 'nk', 'nt', 'nz', 'mv'];
function syllabify(word) {
  const w = word.toLowerCase();
  const syllables = [];
  let i = 0;
  while (i < w.length) {
    let syl = '';
    while (i < w.length && !VOWELS.has(w[i])) {
      let matched = false;
      for (const cl of CLUSTERS) { if (w.startsWith(cl, i)) { syl += cl; i += cl.length; matched = true; break; } }
      if (!matched) syl += w[i++];
    }
    if (i < w.length && VOWELS.has(w[i])) syl += w[i++];
    if (syl) syllables.push(syl);
  }
  if (!syllables.length) return word;
  const stressAt = syllables.length >= 2 ? syllables.length - 2 : 0;
  return syllables.map((s, idx) => (idx === stressAt ? s.toUpperCase() : s)).join('-');
}
const isMonosyllabic = (stem) => syllabify(stem).split('-').length === 1;

// ─── Verb morphology ────────────────────────────────────────────────────────────
const NEG_PREFIX = { ni: 'si', u: 'hu', a: 'ha', tu: 'hatu', m: 'ham', wa: 'hawa' };
const AFF_PREFIX = { ni: 'ni', u: 'u', a: 'a', tu: 'tu', m: 'm', wa: 'wa' };
const TENSE_MARKER = { present: 'na', past: 'li' };
const OBJ_INFIX = { obj_ni: 'ni', obj_ku: 'ku', obj_m: 'm', obj_tu: 'tu' };
const finalAToI = (s) => (s.endsWith('a') ? s.slice(0, -1) + 'i' : s);
const finalAToE = (s) => (s.endsWith('a') ? s.slice(0, -1) + 'e' : s);

/** Returns corrected swahili for a conjugation card, or null if untouched. */
function fixConjugation(key, stem) {
  const parts = key.split(':');            // root:subj:tense[:obj_X]
  const subj = parts[1];
  const tense = parts[2];
  const obj = parts[3];                     // undefined unless object-infix card
  const neg = NEG_PREFIX[subj];
  const aff = AFF_PREFIX[subj];
  if (!neg) return null;

  // P0.1 — negative tenses (uniform across all verbs incl. monosyllabic)
  if (!obj) {
    if (tense === 'neg_present') return neg + finalAToI(stem);
    if (tense === 'neg_past')    return neg + 'ku' + stem;
    if (tense === 'neg_perfect') return neg + 'ja' + stem;
    // P0.3 — monosyllabic subjunctive drops ku- (akule→ale, akuje→aje)
    if (tense === 'subjunctive' && isMonosyllabic(stem)) return aff + finalAToE(stem);
    return null;
  }

  // P0.3 — object infix on a monosyllabic verb drops ku- (ananikula→ananila)
  if (isMonosyllabic(stem) && OBJ_INFIX[obj] && TENSE_MARKER[tense]) {
    return aff + TENSE_MARKER[tense] + OBJ_INFIX[obj] + stem;
  }
  return null;
}

// ─── Adjective concord ──────────────────────────────────────────────────────────
// Concord prefixes for the three stems present in the data: zuri / baya / kubwa.
const CONCORD = {
  N:    { zuri: 'nzuri', baya: 'mbaya', kubwa: 'kubwa' },  // class 9/10 nasal assimilation
  m:    { zuri: 'mzuri', baya: 'mbaya', kubwa: 'mkubwa' }, // class 1/3/11
  wa:   { zuri: 'wazuri', baya: 'wabaya', kubwa: 'wakubwa' }, // class 2
  mi:   { zuri: 'mizuri', baya: 'mibaya', kubwa: 'mikubwa' }, // class 4
  ma:   { zuri: 'mazuri', baya: 'mabaya', kubwa: 'makubwa' }, // class 6
  ki:   { zuri: 'kizuri', baya: 'kibaya', kubwa: 'kikubwa' }, // class 7
  vi:   { zuri: 'vizuri', baya: 'vibaya', kubwa: 'vikubwa' }, // class 8
  zero: { zuri: 'zuri', baya: 'baya', kubwa: 'kubwa' },       // class 5
  pa:   { zuri: 'pazuri', baya: 'pabaya', kubwa: 'pakubwa' }, // class 16 (mahali)
};

// A few nouns carry an incorrect noun_class in the seed data; their concord is
// pinned here so the resolver doesn't inherit the mistag.
const OVERRIDE = {
  damu: 'N',          // blood — class 9 (N), mistagged Ji-Ma
  viwanja: 'vi',      // grounds/fields — class 8 plural, mistagged M-Mi / U
  mustakabali: 'N',   // future — Arabic N-class loan, mistagged U
};

/** Pick the concord set for a noun. Returns a key of CONCORD, or null to skip. */
function concordFor(nounClass, noun, pluralTag, isPeople) {
  if (OVERRIDE[noun]) return OVERRIDE[noun];
  const startsW = /^w[aeiou]/.test(noun);
  switch (nounClass) {
    case 'N-N':
      if (isPeople) return (pluralTag || startsW) ? 'wa' : 'm'; // animate → human concord
      return 'N';
    case 'M-Wa':
      return (pluralTag || startsW) ? 'wa' : 'm';
    case 'Ki-Vi':
      return (pluralTag || /^v[iy]/.test(noun)) ? 'vi' : 'ki';
    case 'M-Mi': {
      const plural = pluralTag || /^mi/.test(noun);
      if (!plural) return 'm';
      return /^mi/.test(noun) ? 'mi' : 'N'; // irregular class-10 plurals (nyuso, ndimi) → N
    }
    case 'Ji-Ma':
      return (pluralTag || /^ma/.test(noun)) ? 'ma' : 'zero';
    case 'U':   return 'm';   // class 11/14 abstract → class-3 concord
    case 'Pa':  return 'pa';
    default:    return null;
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────────
const initSqlJs = require(path.join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-asm.js'));

initSqlJs().then((SQL) => {
  const db = new SQL.Database(fs.readFileSync(DB_PATH));
  const all = (sql) => { const r = db.exec(sql); return r[0] ? r[0].values : []; };

  const stats = { conj: 0, subj: 0, obj: 0, concord: 0, ndiyo: 0, dups: 0 };
  const samples = { conj: [], subj: [], obj: [], concord: [] };
  const concordSeen = new Map();

  // ---- Conjugation fixes (swahili + pronunciation) ----
  const conjRows = all(
    "SELECT id, conjugation_key, verb_root, swahili FROM cards WHERE type='conjugation'"
  );
  for (const [id, key, root, swahili] of conjRows) {
    const fixed = fixConjugation(key, root);
    if (!fixed || fixed === swahili) continue;
    const pron = syllabify(fixed);
    const tense = key.split(':')[2];
    const bucket = key.split(':')[3] ? 'obj' : (tense === 'subjunctive' ? 'subj' : 'conj');
    stats[bucket]++;
    if (samples[bucket].length < 8) samples[bucket].push(`${key}: ${swahili} → ${fixed}  [${pron}]`);
    if (!DRY) db.run('UPDATE cards SET swahili=?, pronunciation=? WHERE id=?', [fixed, pron, id]);
  }

  // ---- Adjective concord fixes (swahili) ----
  const adjRows = all(
    "SELECT id, noun_class, swahili, tags FROM cards WHERE tags LIKE '%adjective-agreement%'"
  );
  for (const [id, nounClass, swahili, tags] of adjRows) {
    const stem = id.split(':-')[1];
    if (!stem || !CONCORD.N[stem]) continue;       // only zuri/baya/kubwa
    const noun = swahili.split(' ')[0];
    const pluralTag = /"plural"/.test(tags || '');
    const isPeople = /"people"/.test(tags || '');
    const ck = concordFor(nounClass, noun, pluralTag, isPeople);
    if (!ck) continue;
    const fixedAdj = CONCORD[ck][stem];
    const fixed = `${noun} ${fixedAdj}`;
    const keyStr = `${nounClass} | ${noun} ${stem}`;
    if (!concordSeen.has(keyStr)) concordSeen.set(keyStr, `${nounClass.padEnd(6)} ${swahili} → ${fixed}`);
    if (fixed === swahili) continue;
    stats.concord++;
    if (!DRY) db.run('UPDATE cards SET swahili=? WHERE id=?', [fixed, id]);
  }

  // ---- P0.4 ndio → ndiyo ----
  const ndio = all("SELECT id FROM cards WHERE swahili='ndio'");
  stats.ndiyo = ndio.length;
  if (!DRY) for (const [id] of ndio) db.run("UPDATE cards SET swahili='ndiyo' WHERE id=?", [id]);

  // NOTE: P0.4 row de-duplication is intentionally NOT done here. The apparent
  // duplicates are the same word/verb seeded into multiple units (distinct ids
  // like gen-unit-09:… vs gen-unit-29:…), not exact-duplicate rows. Deleting them
  // would leave units short of cards, so cross-unit de-duplication is a curriculum
  // decision (or a "already seen in unit X" cross-reference), left for a human.

  // ---- Report ----
  console.log(`\n${DRY ? '[DRY RUN] ' : ''}Phase 0 content fixes`);
  console.log('─'.repeat(60));
  console.log(`P0.1 negative conjugations : ${stats.conj}`);
  console.log(`P0.3 monosyllabic subjunctive: ${stats.subj}`);
  console.log(`P0.3 object-infix monosyllabic: ${stats.obj}`);
  console.log(`P0.2 adjective concord     : ${stats.concord}`);
  console.log(`P0.4 ndio→ndiyo            : ${stats.ndiyo}`);
  for (const k of ['conj', 'subj', 'obj']) {
    if (samples[k].length) { console.log(`\n-- sample ${k} --`); samples[k].forEach((s) => console.log('  ' + s)); }
  }
  console.log('\n-- all distinct concord results (review) --');
  [...concordSeen.values()].sort().forEach((s) => console.log('  ' + s));

  if (!DRY) {
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
    console.log(`\n✓ Saved → ${DB_PATH}`);
  } else {
    console.log('\n(dry run — nothing written)');
  }
  db.close();
}).catch((e) => { console.error(e); process.exit(1); });
