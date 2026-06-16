/**
 * Korean verb conjugation engine — rule-based generation of all major forms.
 *
 * This mirrors the Swahili morphology generators: instead of hand-writing thousands
 * of conjugation cards (and getting them systematically wrong, as the Swahili review
 * showed), we generate them from the verb's dictionary form + irregular marker.
 *
 * Handles: 하다, ㅂ-irregular, ㄹ-irregular, ㅅ-irregular, ㄷ-irregular, 르-irregular,
 * 으-irregular, plus regular verbs/adjectives ending in a vowel or consonant stem.
 *
 * Produces the high-frequency forms a learner actually meets:
 *   - 합니다체 (formal polite): present, past, future (+ negatives)
 *   - 해요체 (polite): present, past, future (+ negatives)
 *   - 반말 (casual): present, past
 *   - Honorific (-시-): polite present, formal polite present
 */

// ── Hangul Unicode composition ─────────────────────────────────────────────────
const HANGUL_BASE = 0xAC00;

// initial-jamo indices for the 19 leading consonants in the syllable block
const I = { 'ㄱ':0,'ㄲ':1,'ㄴ':2,'ㄷ':3,'ㄸ':4,'ㄹ':5,'ㅁ':6,'ㅂ':7,'ㅃ':8,'ㅅ':9,'ㅆ':10,'ㅇ':11,'ㅈ':12,'ㅉ':13,'ㅊ':14,'ㅋ':15,'ㅌ':16,'ㅍ':17,'ㅎ':18 };
// medial-jamo indices for the 21 vowels
const M = { 'ㅏ':0,'ㅐ':1,'ㅑ':2,'ㅒ':3,'ㅓ':4,'ㅔ':5,'ㅕ':6,'ㅖ':7,'ㅗ':8,'ㅘ':9,'ㅙ':10,'ㅚ':11,'ㅛ':12,'ㅜ':13,'ㅝ':14,'ㅞ':15,'ㅟ':16,'ㅠ':17,'ㅡ':18,'ㅢ':19,'ㅣ':20 };
// final-jamo indices (0 = no final, then 27 possible final consonants)
const F = { '':0,'ㄱ':1,'ㄲ':2,'ㄳ':3,'ㄴ':4,'ㄵ':5,'ㄶ':6,'ㄷ':7,'ㄹ':8,'ㄺ':9,'ㄻ':10,'ㄼ':11,'ㄽ':12,'ㄾ':13,'ㄿ':14,'ㅀ':15,'ㅁ':16,'ㅂ':17,'ㅄ':18,'ㅅ':19,'ㅆ':20,'ㅇ':21,'ㅈ':22,'ㅊ':23,'ㅋ':24,'ㅌ':25,'ㅍ':26,'ㅎ':27 };

function decompose(syll) {
  const code = syll.charCodeAt(0) - HANGUL_BASE;
  if (code < 0 || code >= 11172) return null;
  return { initial: Math.floor(code / 588), medial: Math.floor((code % 588) / 28), final: code % 28 };
}
function compose(initial, medial, final = 0) {
  return String.fromCharCode(HANGUL_BASE + initial * 588 + medial * 28 + final);
}
function replaceLastSyll(stem, newSyll) {
  return stem.slice(0, -1) + newSyll;
}
function lastSyllOf(stem) {
  return stem[stem.length - 1];
}
function getDecomposed(stem) {
  return decompose(lastSyllOf(stem));
}

// ── Vowel-harmony helper (the 아/어 rule) ──────────────────────────────────────
function ahOrEo(stem) {
  const d = getDecomposed(stem);
  if (!d) return '어';
  // ㅏ (0) or ㅗ (8) → 아; everything else → 어
  return (d.medial === 0 || d.medial === 8) ? '아' : '어';
}

// Combine stem + 아/어 with the standard contractions (the 해요 form).
function contractAhEo(stem) {
  const d = getDecomposed(stem);
  if (!d || d.final !== 0) {
    // consonant-ending stem: no contraction, just append 아/어
    return stem + ahOrEo(stem);
  }
  // vowel-ending: apply contractions
  const m = d.medial;
  // ㅏ + 아 → ㅏ; ㅓ + 어 → ㅓ; ㅕ + 어 → ㅕ; ㅐ + 어 → ㅐ; ㅔ + 어 → ㅔ — no visible change
  if (m === 0 || m === 4 || m === 6 || m === 1 || m === 5) return stem;
  // ㅗ + 아 → ㅘ
  if (m === 8) return replaceLastSyll(stem, compose(d.initial, M['ㅘ']));
  // ㅜ + 어 → ㅝ
  if (m === 13) return replaceLastSyll(stem, compose(d.initial, M['ㅝ']));
  // ㅣ + 어 → ㅕ (마시 → 마셔)
  if (m === 20) return replaceLastSyll(stem, compose(d.initial, M['ㅕ']));
  // ㅡ irregular handled in conjugate(); shouldn't reach here in normal flow
  // default fallback: explicit 아/어 syllable
  return stem + ahOrEo(stem);
}

// ── Irregular-verb stem transforms ─────────────────────────────────────────────
// Each returns the stem to use BEFORE attaching the next ending. The marker is
// declared on the verb data (`irreg` field). Defaults to 'regular'.

// ㅂ-irregular: stem-final ㅂ → 우 before 아/어 endings  (덥다 → 더워, 쉽다 → 쉬워)
function bIrregBefore(stem) {
  const d = getDecomposed(stem);
  if (!d || d.final !== F['ㅂ']) return stem;
  const stemNoFinal = replaceLastSyll(stem, compose(d.initial, d.medial, 0));
  return stemNoFinal + '우';
}

// ㄷ-irregular: stem-final ㄷ → ㄹ before vowel endings (듣다 → 들어, 걷다 → 걸어)
function dIrregBefore(stem) {
  const d = getDecomposed(stem);
  if (!d || d.final !== F['ㄷ']) return stem;
  return replaceLastSyll(stem, compose(d.initial, d.medial, F['ㄹ']));
}

// ㅅ-irregular: stem-final ㅅ drops before vowel endings (짓다 → 지어, 낫다 → 나아)
function sIrregBefore(stem) {
  const d = getDecomposed(stem);
  if (!d || d.final !== F['ㅅ']) return stem;
  return replaceLastSyll(stem, compose(d.initial, d.medial, 0));
}

// 르-irregular: 르 doubles + ㄹ goes back into the previous syllable's final
// 모르다 → 몰라, 부르다 → 불러
function reuIrregBefore(stem) {
  if (!stem.endsWith('르') || stem.length < 2) return stem;
  const prev = stem[stem.length - 2];
  const dPrev = decompose(prev);
  if (!dPrev) return stem;
  const ah = ahOrEo(stem.slice(0, -1)); // determined by prev syllable's vowel
  // attach ㄹ to prev syllable
  const prevWithL = compose(dPrev.initial, dPrev.medial, F['ㄹ']);
  // replace 르 with 라/러 (initial ㄹ + ㅏ/ㅓ)
  const newLast = ah === '아' ? compose(I['ㄹ'], M['ㅏ']) : compose(I['ㄹ'], M['ㅓ']);
  return stem.slice(0, -2) + prevWithL + newLast;
}

// 으-irregular: stem-final 으 drops; 아/어 attached based on PRECEDING syllable's vowel
// 쓰다 → 써 (no preceding → 어); 바쁘다 → 바빠 (preceding ㅏ → 아); 크다 → 커
function euIrregBefore(stem) {
  if (!stem.endsWith('으') && !stem.endsWith('쁘') && !stem.endsWith('크') && !stem.endsWith('뜨') && !stem.endsWith('트') && !stem.endsWith('쓰') && !stem.endsWith('느') && !stem.endsWith('르') && !stem.endsWith('드') && !stem.endsWith('프')) {
    // generic detection: stem's last vowel is ㅡ (medial 18)
    const d = getDecomposed(stem);
    if (!d || d.medial !== 18) return stem;
  }
  const d = getDecomposed(stem);
  if (!d) return stem;
  const droppedStem = replaceLastSyll(stem, compose(d.initial, 0)); // drop last syll's vowel placeholder
  // Determine vowel by preceding syllable's vowel
  let ah = '어';
  if (stem.length >= 2) {
    const prev = decompose(stem[stem.length - 2]);
    if (prev && (prev.medial === 0 || prev.medial === 8)) ah = '아';
  }
  const newVowel = ah === '아' ? M['ㅏ'] : M['ㅓ'];
  return stem.slice(0, -1) + compose(d.initial, newVowel);
}

// ㄹ-irregular: ㄹ drops before ㅂ/ㄴ/ㅅ/(ㄹ) endings. Used for the formal-polite (-ㅂ니다) form.
function lDropForFinalPolite(stem) {
  const d = getDecomposed(stem);
  if (!d || d.final !== F['ㄹ']) return stem;
  return replaceLastSyll(stem, compose(d.initial, d.medial, 0));
}

// ── Form generators ───────────────────────────────────────────────────────────

// Get the bare stem (dictionary form minus 다).
function getStem(dict) {
  return dict.endsWith('다') ? dict.slice(0, -1) : dict;
}

// 합니다 form: formal polite present declarative
function formalPolitePresent(verb) {
  if (verb.irreg === 'hada' || verb.dict.endsWith('하다')) {
    return getStem(verb.dict).slice(0, -1) + '합니다';
  }
  let stem = getStem(verb.dict);
  if (verb.irreg === 'l') stem = lDropForFinalPolite(stem);
  const d = getDecomposed(stem);
  if (!d) return stem + '습니다';
  if (d.final === 0) {
    // vowel-final → +ㅂ니다 (attach ㅂ to last syllable)
    return replaceLastSyll(stem, compose(d.initial, d.medial, F['ㅂ'])) + '니다';
  }
  return stem + '습니다';
}

// 합니다 past
function formalPolitePast(verb) {
  const haeyo = politePresent(verb);          // e.g. 가요
  if (!haeyo) return null;
  const beforeYo = haeyo.slice(0, -1);          // e.g. 가
  // attach ㅆ (final 20) to the last syllable, then 습니다
  const d = decompose(beforeYo[beforeYo.length - 1]);
  if (!d) return beforeYo + '었습니다';
  return beforeYo.slice(0, -1) + compose(d.initial, d.medial, F['ㅆ']) + '습니다';
}

// 합니다 future (intent / commitment): stem + 겠습니다
function formalPoliteFuture(verb) {
  return getStem(verb.dict) + '겠습니다';
}

// 해요 form: polite present
function politePresent(verb) {
  if (verb.irreg === 'hada' || verb.dict.endsWith('하다')) {
    return getStem(verb.dict).slice(0, -1) + '해요';
  }
  let stem = getStem(verb.dict);
  if (verb.irreg === 'b')   stem = bIrregBefore(stem);
  else if (verb.irreg === 'd')   stem = dIrregBefore(stem);
  else if (verb.irreg === 's')   stem = sIrregBefore(stem);
  else if (verb.irreg === 'reu') return reuIrregBefore(stem) + '요';
  else if (verb.irreg === 'eu')  return euIrregBefore(stem) + '요';
  return contractAhEo(stem) + '요';
}

// 해요 past: same as polite present but with ㅆ + 어요
function politePast(verb) {
  // build the contracted stem (the part before 요), then attach ㅆ어요
  const polite = politePresent(verb);
  if (!polite) return null;
  const before = polite.slice(0, -1);              // drop 요
  const d = decompose(before[before.length - 1]);
  if (!d) return before + '었어요';
  // append ㅆ as final, then 어요
  return before.slice(0, -1) + compose(d.initial, d.medial, F['ㅆ']) + '어요';
}

// 해요 future: stem + (으)ㄹ 거예요
function politeFuture(verb) {
  let stem = getStem(verb.dict);
  if (verb.irreg === 'l') return stem + ' 거예요'; // ㄹ-stem: no extra ㄹ needed
  const d = getDecomposed(stem);
  if (!d) return stem + '을 거예요';
  if (d.final === 0) {
    // vowel-final: attach ㄹ to last syllable
    return replaceLastSyll(stem, compose(d.initial, d.medial, F['ㄹ'])) + ' 거예요';
  }
  return stem + '을 거예요';
}

// 반말 present (casual) = 해요 present minus 요
function casualPresent(verb) {
  const p = politePresent(verb);
  return p ? p.slice(0, -1) : null;
}
function casualPast(verb) {
  const p = politePast(verb);
  return p ? p.slice(0, -1) : null;
}

// Negative forms via 안 (short negation) — works for verbs and most adjectives.
function negative(form) {
  return '안 ' + form;
}

// Honorific -시- forms (used when subject is socially superior):
// Polite present: stem + (으)세요 — irregular for 있다 → 계세요, 먹다 → 드세요 etc.
function honorificPolitePresent(verb) {
  if (verb.honorificOverride) return verb.honorificOverride;
  if (verb.irreg === 'l') return getStem(verb.dict) + '세요'; // ㄹ-stem: drop ㄹ for 시 too
  const stem = getStem(verb.dict);
  const d = getDecomposed(stem);
  if (!d) return stem + '으세요';
  return d.final === 0 ? stem + '세요' : stem + '으세요';
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * verb = {
 *   dict:   '가다',
 *   en:     'to go',         // English gloss
 *   pos:    'verb' | 'adjective',
 *   irreg:  'regular' | 'hada' | 'b' | 'd' | 's' | 'reu' | 'eu' | 'l',
 *   honorificOverride?: '드세요',  // for 먹다 / 마시다 etc.
 * }
 */
function conjugateAll(verb) {
  return {
    formalPolitePresent: formalPolitePresent(verb),
    formalPolitePast:    formalPolitePast(verb),
    formalPoliteFuture:  formalPoliteFuture(verb),
    politePresent:       politePresent(verb),
    politePast:          politePast(verb),
    politeFuture:        politeFuture(verb),
    casualPresent:       casualPresent(verb),
    casualPast:          casualPast(verb),
    negPolitePresent:    negative(politePresent(verb)),
    negPolitePast:       negative(politePast(verb)),
    negFormalPresent:    negative(formalPolitePresent(verb)),
    negFormalPast:       negative(formalPolitePast(verb)),
    honorificPolite:     honorificPolitePresent(verb),
  };
}

// ── Lightweight Revised Romanization ─────────────────────────────────────────
// Syllable-by-syllable. Doesn't model inter-syllable assimilation perfectly
// (e.g. ㄴ+ㄹ → ㄹ+ㄹ), but produces readable, mostly-correct romanization for
// generated conjugation forms.
const ROM_INITIAL = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const ROM_MEDIAL  = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const ROM_FINAL   = ['','k','k','ks','n','nj','nh','t','l','lg','lm','lb','ls','lt','lp','lh','m','p','ps','s','ss','ng','j','ch','k','t','p','h'];
// Some finals romanize differently when followed by a vowel; the simple version below
// works well enough for the form vocabulary we generate.

// Final + next-syllable onset transitions. When a syllable's final consonant is
// immediately followed by ㅇ (silent placeholder), the final carries to the next
// onset and uses its lenis form (먹어 → meogeo, 들어 → deureo). Doubled ㄹㄹ → ll.
const FINAL_LENIS_ONSET = {
  1:  ['',   'g'],     // ㄱ
  4:  ['',   'n'],     // ㄴ
  7:  ['',   'd'],     // ㄷ
  8:  ['l',  'r'],     // ㄹ — keeps 'l' before consonant onset; 'r' before vowel onset
  16: ['',   'm'],     // ㅁ
  17: ['',   'b'],     // ㅂ
  19: ['',   's'],     // ㅅ
  20: ['',   'ss'],    // ㅆ
  21: ['ng', 'ng'],    // ㅇ
  22: ['',   'j'],     // ㅈ
  23: ['',   'ch'],    // ㅊ
};

function romanize(text) {
  let out = '';
  const chars = [...text];
  let lastWasSpace = true;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ') { out += ' '; lastWasSpace = true; continue; }
    const d = decompose(ch);
    if (!d) { out += ch; lastWasSpace = false; continue; }
    let initial = ROM_INITIAL[d.initial];
    // ㄹ at the start of a word-medial syllable: 'r' between vowels feels more natural
    if (d.initial === 5 /* ㄹ */ && !lastWasSpace) initial = 'r';
    // Lookahead: if this syllable has a final consonant and the next starts with ㅇ,
    // shift the final into the next syllable's onset (the standard "linking" rule).
    let finalRom = ROM_FINAL[d.final];
    let nextOverride = null;
    const next = chars[i + 1];
    if (d.final !== 0 && next && next !== ' ') {
      const dn = decompose(next);
      if (dn) {
        const map = FINAL_LENIS_ONSET[d.final];
        if (map) {
          if (dn.initial === 11 /* ㅇ */) {
            // ㅇ onset is silent → final carries as the next syllable's onset
            finalRom = '';
            nextOverride = map[1];
          } else if (d.final === 8 /* ㄹ */ && dn.initial === 5 /* ㄹ */) {
            // ㄹ + ㄹ → ll (e.g. 몰라요)
            finalRom = 'l';
            nextOverride = 'l';
          } else if (d.final === 17 /* ㅂ */ && dn.initial === 2 /* ㄴ */) {
            // Nasal assimilation: 합니다 → hamnida
            finalRom = 'm';
          } else if (d.final === 1 /* ㄱ */ && dn.initial === 2 /* ㄴ */) {
            // ㄱ + ㄴ → ng + n
            finalRom = 'ng';
          } else if (d.final === 7 /* ㄷ */ && dn.initial === 2 /* ㄴ */) {
            // ㄷ + ㄴ → n + n
            finalRom = 'n';
          } else if (d.final === 17 /* ㅂ */ && dn.initial === 6 /* ㅁ */) {
            // ㅂ + ㅁ → m + m
            finalRom = 'm';
          }
        }
      }
    }
    out += initial + ROM_MEDIAL[d.medial] + finalRom;
    lastWasSpace = false;
    if (nextOverride !== null) {
      // override the next syllable's initial when we render it next loop iteration
      const dn = decompose(next);
      const customInitial = nextOverride;
      out += customInitial + ROM_MEDIAL[dn.medial] + ROM_FINAL[dn.final];
      i++; // consumed next char
      lastWasSpace = false;
    }
  }
  return out;
}

module.exports = { conjugateAll, getStem, romanize };
