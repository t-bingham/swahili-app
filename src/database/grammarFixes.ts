import type { Database } from 'sql.js';

/**
 * Phase 0 curriculum-correctness repair, applied to already-cloned user DBs.
 *
 * The seed template (`public/swahili_default.db`) is fixed at build time by
 * `scripts/fix-grammar-content.cjs`; this module is the identical fix expressed
 * for the in-browser sql.js DB so existing users get the corrections on open.
 * It regenerates the wrong forms from morphological components, so it is
 * deterministic and safe to run more than once.
 *
 * Fixes: negative conjugations (neg_present -a→-i; neg_past -ku-; neg_perfect
 * -ja-), monosyllabic subjunctive (akule→ale) and object-infix (ananikula→
 * ananila), adjective–noun concord (removes non-words like nbaya/nkubwa,
 * applies animacy/number/class agreement), and ndio→ndiyo.
 */

// ─── Swahili syllabifier (matches scripts/fill-pronunciation.cjs) ───────────────
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const CLUSTERS = ["ng'", 'ny', 'sh', 'ch', 'dh', 'gh', 'kh', 'th', 'mb', 'nd', 'nj', 'nk', 'nt', 'nz', 'mv'];

function syllabify(word: string): string {
  const w = word.toLowerCase();
  const syllables: string[] = [];
  let i = 0;
  while (i < w.length) {
    let syl = '';
    while (i < w.length && !VOWELS.has(w[i])) {
      let matched = false;
      for (const cl of CLUSTERS) {
        if (w.startsWith(cl, i)) { syl += cl; i += cl.length; matched = true; break; }
      }
      if (!matched) syl += w[i++];
    }
    if (i < w.length && VOWELS.has(w[i])) syl += w[i++];
    if (syl) syllables.push(syl);
  }
  if (!syllables.length) return word;
  const stressAt = syllables.length >= 2 ? syllables.length - 2 : 0;
  return syllables.map((s, idx) => (idx === stressAt ? s.toUpperCase() : s)).join('-');
}
const isMonosyllabic = (stem: string) => syllabify(stem).split('-').length === 1;

// ─── Verb morphology ────────────────────────────────────────────────────────────
const NEG_PREFIX: Record<string, string> = { ni: 'si', u: 'hu', a: 'ha', tu: 'hatu', m: 'ham', wa: 'hawa' };
const AFF_PREFIX: Record<string, string> = { ni: 'ni', u: 'u', a: 'a', tu: 'tu', m: 'm', wa: 'wa' };
const TENSE_MARKER: Record<string, string> = { present: 'na', past: 'li' };
const OBJ_INFIX: Record<string, string> = { obj_ni: 'ni', obj_ku: 'ku', obj_m: 'm', obj_tu: 'tu' };
const finalAToI = (s: string) => (s.endsWith('a') ? s.slice(0, -1) + 'i' : s);
const finalAToE = (s: string) => (s.endsWith('a') ? s.slice(0, -1) + 'e' : s);

function fixConjugation(key: string, stem: string): string | null {
  const parts = key.split(':');           // root:subj:tense[:obj_X]
  const subj = parts[1];
  const tense = parts[2];
  const obj = parts[3];
  const neg = NEG_PREFIX[subj];
  const aff = AFF_PREFIX[subj];
  if (!neg) return null;
  if (!obj) {
    if (tense === 'neg_present') return neg + finalAToI(stem);
    if (tense === 'neg_past') return neg + 'ku' + stem;
    if (tense === 'neg_perfect') return neg + 'ja' + stem;
    if (tense === 'subjunctive' && isMonosyllabic(stem)) return aff + finalAToE(stem);
    return null;
  }
  if (isMonosyllabic(stem) && OBJ_INFIX[obj] && TENSE_MARKER[tense]) {
    return aff + TENSE_MARKER[tense] + OBJ_INFIX[obj] + stem;
  }
  return null;
}

// ─── Adjective concord ──────────────────────────────────────────────────────────
type Stem = 'zuri' | 'baya' | 'kubwa';
const CONCORD: Record<string, Record<Stem, string>> = {
  N:    { zuri: 'nzuri', baya: 'mbaya', kubwa: 'kubwa' },
  m:    { zuri: 'mzuri', baya: 'mbaya', kubwa: 'mkubwa' },
  wa:   { zuri: 'wazuri', baya: 'wabaya', kubwa: 'wakubwa' },
  mi:   { zuri: 'mizuri', baya: 'mibaya', kubwa: 'mikubwa' },
  ma:   { zuri: 'mazuri', baya: 'mabaya', kubwa: 'makubwa' },
  ki:   { zuri: 'kizuri', baya: 'kibaya', kubwa: 'kikubwa' },
  vi:   { zuri: 'vizuri', baya: 'vibaya', kubwa: 'vikubwa' },
  zero: { zuri: 'zuri', baya: 'baya', kubwa: 'kubwa' },
  pa:   { zuri: 'pazuri', baya: 'pabaya', kubwa: 'pakubwa' },
};
const OVERRIDE: Record<string, string> = { damu: 'N', viwanja: 'vi', mustakabali: 'N' };

function concordFor(nounClass: string, noun: string, pluralTag: boolean, isPeople: boolean): string | null {
  if (OVERRIDE[noun]) return OVERRIDE[noun];
  const startsW = /^w[aeiou]/.test(noun);
  switch (nounClass) {
    case 'N-N': return isPeople ? ((pluralTag || startsW) ? 'wa' : 'm') : 'N';
    case 'M-Wa': return (pluralTag || startsW) ? 'wa' : 'm';
    case 'Ki-Vi': return (pluralTag || /^v[iy]/.test(noun)) ? 'vi' : 'ki';
    case 'M-Mi': {
      const plural = pluralTag || /^mi/.test(noun);
      if (!plural) return 'm';
      return /^mi/.test(noun) ? 'mi' : 'N';
    }
    case 'Ji-Ma': return (pluralTag || /^ma/.test(noun)) ? 'ma' : 'zero';
    case 'U': return 'm';
    case 'Pa': return 'pa';
    default: return null;
  }
}

function rows(db: Database, sql: string): unknown[][] {
  const r = db.exec(sql);
  return r[0] ? r[0].values : [];
}

/** Applies all Phase 0 content corrections in place. Idempotent. */
export function fixGrammarContent(db: Database): void {
  // Conjugations: regenerate swahili + pronunciation for the affected forms.
  for (const row of rows(db, "SELECT id, conjugation_key, verb_root, swahili FROM cards WHERE type='conjugation'")) {
    const [id, key, root, swahili] = row as [string, string, string, string];
    const fixed = fixConjugation(key, root);
    if (!fixed || fixed === swahili) continue;
    db.run('UPDATE cards SET swahili=?, pronunciation=? WHERE id=?', [fixed, syllabify(fixed), id]);
  }

  // Adjective concord: regenerate swahili.
  for (const row of rows(db, "SELECT id, noun_class, swahili, tags FROM cards WHERE tags LIKE '%adjective-agreement%'")) {
    const [id, nounClass, swahili, tags] = row as [string, string, string, string];
    const stem = id.split(':-')[1] as Stem;
    if (!stem || !CONCORD.N[stem]) continue;
    const noun = swahili.split(' ')[0];
    const ck = concordFor(nounClass, noun, /"plural"/.test(tags || ''), /"people"/.test(tags || ''));
    if (!ck) continue;
    const fixed = `${noun} ${CONCORD[ck][stem]}`;
    if (fixed !== swahili) db.run('UPDATE cards SET swahili=? WHERE id=?', [fixed, id]);
  }

  db.run("UPDATE cards SET swahili='ndiyo' WHERE swahili='ndio'");
}
