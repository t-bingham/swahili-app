/**
 * Test script: verify conjugation English transformations
 * Run: node scripts/test-conj-transform.cjs
 */

// ── Irregular verb tables ─────────────────────────────────────────────────────

const IRREG_PAST = {
  'be':'was/were','become':'became','begin':'began','break':'broke','bring':'brought',
  'build':'built','buy':'bought','choose':'chose','come':'came',
  'cut':'cut','do':'did','draw':'drew','drink':'drank','drive':'drove',
  'eat':'ate','fall':'fell','feel':'felt','fight':'fought','find':'found',
  'flee':'fled','fly':'flew','forget':'forgot','forgive':'forgave',
  'get':'got','give':'gave','go':'went','grow':'grew','have':'had',
  'hear':'heard','hit':'hit','hold':'held','keep':'kept','know':'knew',
  'lay':'laid','lead':'led','leap':'leapt','leave':'left','let':'let',
  'lie':'lay','lose':'lost','make':'made','mean':'meant',
  'overcome':'overcame','pay':'paid','put':'put','quit':'quit',
  'read':'read','run':'ran','say':'said','see':'saw','sell':'sold',
  'send':'sent','shine':'shone','show':'showed','sing':'sang','sit':'sat',
  'sleep':'slept','speak':'spoke','spend':'spent','spread':'spread',
  'stand':'stood','stink':'stank','swim':'swam','take':'took',
  'teach':'taught','tell':'told','think':'thought','throw':'threw',
  'understand':'understood','wake':'woke','wear':'wore','weep':'wept',
  'win':'won','write':'wrote',
};

const IRREG_PP = {
  'be':'been','become':'become','begin':'begun','break':'broken','bring':'brought',
  'build':'built','buy':'bought','choose':'chosen','come':'come',
  'cut':'cut','do':'done','draw':'drawn','drink':'drunk','drive':'driven',
  'eat':'eaten','fall':'fallen','feel':'felt','fight':'fought','find':'found',
  'flee':'fled','fly':'flown','forget':'forgotten','forgive':'forgiven',
  'get':'gotten','give':'given','go':'gone','grow':'grown','have':'had',
  'hear':'heard','hit':'hit','hold':'held','keep':'kept','know':'known',
  'lay':'laid','lead':'led','leap':'leapt','leave':'left','let':'let',
  'lie':'lain','lose':'lost','make':'made','mean':'meant',
  'overcome':'overcome','pay':'paid','put':'put','quit':'quit',
  'read':'read','run':'run','say':'said','see':'seen','sell':'sold',
  'send':'sent','shine':'shone','show':'shown','sing':'sung','sit':'sat',
  'sleep':'slept','speak':'spoken','spend':'spent','spread':'spread',
  'stand':'stood','stink':'stunk','swim':'swum','take':'taken',
  'teach':'taught','tell':'told','think':'thought','throw':'thrown',
  'understand':'understood','wake':'woken','wear':'worn','weep':'wept',
  'win':'won','write':'written',
};

const GERUND_DOUBLES = new Set([
  'begin','chat','cut','drop','fit','forget','get','grab','hit','hop',
  'hug','jog','knit','let','mop','nod','pat','plan','plug','pop',
  'put','run','set','sit','skip','slam','slap','slip','snap','sob',
  'spin','stop','stun','swim','tap','tip','tug','win','wrap',
]);

// Modal verbs — skip these as standalone alternatives (they can't conjugate normally)
const SKIP_ALTS = new Set(['can','may','might','shall','will','would','could','should']);

function _gerundize(word) {
  const space = word.indexOf(' ');
  if (space !== -1) return _gerundize(word.slice(0, space)) + word.slice(space);
  const OVERRIDES = { be:'being', lie:'lying', die:'dying', tie:'tying' };
  if (OVERRIDES[word]) return OVERRIDES[word];
  if (word.endsWith('ie')) return word.slice(0,-2) + 'ying';
  if (GERUND_DOUBLES.has(word)) return word + word[word.length-1] + 'ing';
  if (word.endsWith('e') && !word.match(/[eoy]e$/)) return word.slice(0,-1) + 'ing';
  return word + 'ing';
}

function _past(word) {
  if (IRREG_PAST[word]) return IRREG_PAST[word];
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return word.slice(0,-1) + 'ied';
  if (word.endsWith('e')) return word + 'd';
  if (GERUND_DOUBLES.has(word)) return word + word[word.length-1] + 'ed';
  return word + 'ed';
}

function _pp(word) {
  if (IRREG_PP[word]) return IRREG_PP[word];
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return word.slice(0,-1) + 'ied';
  if (word.endsWith('e')) return word + 'd';
  if (GERUND_DOUBLES.has(word)) return word + word[word.length-1] + 'ed';
  return word + 'ed';
}

const BE_PRES = { 'I':'am', 'you':'are', 'he/she':'is', 'we':'are', 'you all':'are', 'they':'are' };
const BE_PAST = { 'I':'was', 'you':'were', 'he/she':'was', 'we':'were', 'you all':'were', 'they':'were' };
const HAVE    = { 'I':'have','you':'have','he/she':'has','we':'have','you all':'have','they':'have'   };
const HAVENT  = { 'I':"haven't",'you':"haven't",'he/she':"hasn't",'we':"haven't",'you all':"haven't",'they':"haven't" };

/**
 * Build natural English for ONE alternative verb phrase (no slashes).
 * alt: "to read" | "to be happy" | "be happy" | "read" | "can"
 */
function _buildSingle(subject, tense, alt) {
  const stripped = alt.replace(/^to\s+/, '').trim(); // "read" | "be happy" | "can"
  const mainVerb = stripped.split(' ')[0];           // "read" | "be" | "can"
  const rest = stripped.slice(mainVerb.length);      // "" | " happy" | ""
  const isBe = mainVerb === 'be';

  const ger  = isBe ? 'being' : (_gerundize(mainVerb) + rest);
  const past = isBe ? (BE_PAST[subject] + rest) : (_past(mainVerb) + rest);
  const pp   = isBe ? ('been' + rest) : (_pp(mainVerb) + rest);
  const base = stripped;

  // Normalise tense key: "neg present" → "neg_present", "conditional past" → "conditional_past"
  const t = tense.toLowerCase().replace(/\s+/g, '_');

  switch (t) {
    case 'present':          return isBe
      ? `${subject} ${BE_PRES[subject]}${rest}`
      : `${subject} ${BE_PRES[subject]} ${ger}`;
    case 'past':             return `${subject} ${past}`;
    case 'future':           return `${subject} will ${base}`;
    case 'perfect':          return `${subject} ${HAVE[subject]} ${pp}`;
    case 'habitual':         return isBe
      ? `${subject} ${BE_PRES[subject]} usually${rest}`
      : `${subject} usually ${base}`;
    case 'subjunctive':      return `${subject} should ${base}`;
    case 'neg_present':      return isBe
      ? `${subject} ${BE_PRES[subject]} not${rest}`
      : `${subject} ${BE_PRES[subject]} not ${ger}`;
    case 'neg_past':         return isBe
      ? `${subject} ${BE_PAST[subject].replace('was',"wasn't").replace('were',"weren't")}${rest}`
      : `${subject} didn't ${base}`;
    case 'neg_perfect':      return `${subject} ${HAVENT[subject]} ${pp}`;
    case 'conditional':      return `${subject} would ${base}`;
    case 'conditional_past': return `${subject} would have ${pp}`;
    default: return null;
  }
}

/**
 * Build English for a slash-separated phrase, then compress shared prefix.
 * "to read / to study" → results: ["I am reading","I am studying"]
 *                      → compressed: "I am reading / studying"
 */
function _buildEnglish(subject, tense, verbPhrase) {
  // Parse out alternatives
  const alts = verbPhrase.split(/\s*\/\s*/).map(a => a.trim()).filter(a => a);

  // Skip pure modals that can't be conjugated normally ("can", "may", etc.)
  const filtered = alts.filter(a => !SKIP_ALTS.has(a.replace(/^to\s+/, '').trim()));
  if (!filtered.length) filtered.push(...alts); // if all were skipped, keep them

  const results = filtered.map(alt => _buildSingle(subject, tense, alt));
  if (results.some(r => !r)) return null;

  // Attempt prefix compression: "I am reading / I am studying" → "I am reading / studying"
  if (results.length >= 2) {
    const words0 = results[0].split(' ');
    const wordsN = results.map(r => r.split(' '));
    let commonLen = 0;
    outer: for (let i = 0; i < words0.length; i++) {
      for (const ws of wordsN) {
        if (i >= ws.length || ws[i] !== words0[i]) break outer;
      }
      commonLen++;
    }
    if (commonLen >= 2) {
      const prefix = words0.slice(0, commonLen).join(' ');
      const suffixes = results.map(r => r.slice(prefix.length).trim()).filter(s => s);
      if (suffixes.length === results.length) {
        return `${prefix} ${suffixes.join(' / ')}`;
      }
    }
  }

  return results.join(' / ');
}

/**
 * Top-level transform. Returns new English string or null if not matched.
 */
function transformConjEnglish(english) {
  // Pattern 2: "[object infix -ni-] I [present] to read / to study"
  const objMatch = english.match(
    /^(\[object infix -[^-]+-\])\s+(I|you|he\/she|we|you pl|they)\s+\[([^\]]+)\]\s+(.+)$/
  );
  // Pattern 1: regular — "I [present] to read / to study"
  const regMatch = english.match(
    /^(I|you|he\/she|we|you pl|they)\s+\[([^\]]+)\]\s+(.+)$/
  );

  if (objMatch) {
    const [, objPrefix, rawSubject, tense, verbPhrase] = objMatch;
    const subject = rawSubject === 'you pl' ? 'you all' : rawSubject;
    const natural = _buildEnglish(subject, tense, verbPhrase);
    if (!natural) return null;
    return `${objPrefix} ${natural}`;
  }

  if (regMatch) {
    const [, rawSubject, tense, verbPhrase] = regMatch;
    const subject = rawSubject === 'you pl' ? 'you all' : rawSubject;
    return _buildEnglish(subject, tense, verbPhrase);
  }

  return null;
}

// ── Run against the actual database ──────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const initSqlJs = require('../node_modules/sql.js/dist/sql-asm.js');
const DB_PATH = path.join(__dirname, '..', 'public', 'swahili_default.db');

initSqlJs().then(SQL => {
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  const rows = db.exec(
    "SELECT id, english FROM cards WHERE type='conjugation' AND english LIKE '%[%]%'"
  );
  if (!rows.length) { console.log('No cards found'); db.close(); return; }

  let ok = 0, problems = [];
  for (const [id, english] of rows[0].values) {
    const result = transformConjEnglish(english);
    if (!result) { problems.push({ id, old: english, new: null, reason: 'no match' }); continue; }
    if (result.includes('[') && !result.includes('[object infix')) {
      problems.push({ id, old: english, new: result, reason: 'still has brackets' }); continue;
    }
    ok++;
  }

  console.log(`Transformed: ${ok} | Problems: ${problems.length}`);
  if (problems.length) {
    console.log('\n=== PROBLEMS ===');
    problems.slice(0,20).forEach(p =>
      console.log(` [${p.reason}]\n  OLD: ${p.old}\n  NEW: ${p.new}`)
    );
  }

  // Check specific edge-case verbs
  const CHECK_ROOTS = ['wa', 'choka', 'furahi', 'weza', 'kasirika', 'ogopa', 'la', 'kimbia', 'enda'];
  for (const root of CHECK_ROOTS) {
    const rows2 = db.exec(`SELECT english FROM cards WHERE verb_root='${root}' AND type='conjugation' AND english NOT LIKE '[object infix%' LIMIT 11`);
    if (!rows2.length) { console.log(`\n[${root}] — NOT FOUND`); continue; }
    console.log(`\n=== ${root} ===`);
    const seen = new Set();
    for (const [en] of rows2[0].values) {
      const r = transformConjEnglish(en);
      const key = en;
      if (!seen.has(key)) { seen.add(key); console.log(`  ${en}\n  → ${r}`); }
    }
  }

  db.close();
});
