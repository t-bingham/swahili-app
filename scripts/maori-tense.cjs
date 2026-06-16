/**
 * Te Reo Māori tense / aspect generator.
 *
 * Te reo does not conjugate verbs. Tense is marked by particles that BRACKET
 * the verb. For a verb "kai" (to eat), the speaker plus context produces:
 *
 *    Kei te kai au           — I am eating          (present continuous)
 *    E kai ana au            — I am (currently) eating   (alt. continuous)
 *    Kua kai au              — I have eaten         (perfective)
 *    I kai au                — I ate                (past)
 *    Ka kai au               — I will eat / I eat   (inceptive / future / habitual)
 *    Me kai au               — I should eat        (deontic)
 *
 * For stative adjectives, "He ___" frames the present, "I ___ ana" the past:
 *
 *    He pai tēnei            — This is good
 *    He pai tēnei i tērā wā  — This was good then  (using a time phrase; the
 *                                                    stative itself stays "He pai")
 *
 * So we generate ONE pattern per particle for verbs, plus a small set of stative
 * patterns for adjectives. With 6 verb patterns × ~50 verbs + 4 adj patterns ×
 * ~20 adjectives we get ~300–400 pattern cards, mirroring the Korean script's
 * conjugation multiplier (Te reo's "multiplier" is necessarily smaller because
 * the language does less verb morphology).
 *
 * IMPORTANT: every generated card uses "au" (I) as the subject and includes a
 * note that the same particle frame works with any subject. Native speaker
 * review can swap subjects later — the structural pattern is what we're
 * teaching here.
 */

// English helpers ────────────────────────────────────────────────────────────
const IRR_PAST = {
  go: 'went', come: 'came', eat: 'ate', drink: 'drank', do: 'did', give: 'gave',
  take: 'took', see: 'saw', sleep: 'slept', know: 'knew', think: 'thought',
  say: 'said', meet: 'met', sell: 'sold', buy: 'bought', read: 'read',
  write: 'wrote', send: 'sent', sing: 'sang', win: 'won', lose: 'lost',
  fall: 'fell', find: 'found', wear: 'wore', stand: 'stood', sit: 'sat',
  run: 'ran', catch: 'caught', teach: 'taught', forget: 'forgot',
  understand: 'understood', hold: 'held', fight: 'fought', strike: 'struck',
  hear: 'heard', feel: 'felt', leave: 'left', begin: 'began', build: 'built',
};

const IRR_PARTICIPLE = {
  go: 'gone', come: 'come', eat: 'eaten', drink: 'drunk', do: 'done',
  give: 'given', take: 'taken', see: 'seen', sleep: 'slept', know: 'known',
  write: 'written', read: 'read', sing: 'sung', forget: 'forgotten',
  fall: 'fallen', find: 'found', understand: 'understood',
  // default for the rest is the simple past
};

function pastOf(base) {
  const first = base.split(/\s+/)[0];
  if (IRR_PAST[first]) return base.replace(first, IRR_PAST[first]);
  if (first.endsWith('e')) return base.replace(first, first + 'd');
  if (/[bcdfghjklmnpqrstvwxz]y$/.test(first)) return base.replace(first, first.slice(0, -1) + 'ied');
  return base.replace(first, first + 'ed');
}

function participleOf(base) {
  const first = base.split(/\s+/)[0];
  if (IRR_PARTICIPLE[first]) return base.replace(first, IRR_PARTICIPLE[first]);
  return pastOf(base);
}

function gerundOf(base) {
  const first = base.split(/\s+/)[0];
  let stem = first;
  if (stem.endsWith('e') && stem !== 'be') stem = stem.slice(0, -1);
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(stem) && stem.length === 3) stem = stem + stem[stem.length - 1];
  return base.replace(first, stem + 'ing');
}

// Patterns ────────────────────────────────────────────────────────────────────
// Each pattern: builds the Māori sentence + matching English from a verb.
// For statives ("to be X"), the "base" English is "X" (drop "be ").
function verbBase(verb) {
  return verb.en.replace(/^to\s+/, '');
}
function adjStem(verb) {
  // "to be hot" → "hot"
  return verb.en.replace(/^to\s+be\s+/, '').replace(/^to\s+/, '');
}

const VERB_PATTERNS = [
  {
    key: 'kei-te',
    label: 'present continuous (kei te)',
    suffix: 'kt',
    register: 'neutral',
    note: 'Present continuous with "kei te ___" — "I am ___-ing". The most everyday tense frame in te reo.',
    miFrom: v => `Kei te ${v.base} au`,
    pronFrom: v => `KAY teh ${v.pron} OW`,
    enFrom:   v => `I am ${gerundOf(verbBase(v))}`,
  },
  {
    key: 'e-ana',
    label: 'present continuous (e ___ ana)',
    suffix: 'ea',
    register: 'neutral',
    note: 'Continuous frame using "e ___ ana" — close in meaning to "kei te ___". Common in narrative and song.',
    miFrom: v => `E ${v.base} ana au`,
    pronFrom: v => `EH ${v.pron} AH-nah OW`,
    enFrom:   v => `I am ${gerundOf(verbBase(v))} (currently)`,
  },
  {
    key: 'kua',
    label: 'perfective (kua)',
    suffix: 'ku',
    register: 'neutral',
    note: 'Perfective — "kua ___" marks a completed action or change of state ("I have ___-ed", "it has become ___").',
    miFrom: v => `Kua ${v.base} au`,
    pronFrom: v => `KOO-ah ${v.pron} OW`,
    enFrom:   v => `I have ${participleOf(verbBase(v))}`,
  },
  {
    key: 'i',
    label: 'past (i)',
    suffix: 'pa',
    register: 'neutral',
    note: 'Past tense — "i ___" marks a past event. ("Past" i is distinct from object-marker i, told apart by position.)',
    miFrom: v => `I ${v.base} au`,
    pronFrom: v => `EE ${v.pron} OW`,
    enFrom:   v => `I ${pastOf(verbBase(v))}`,
  },
  {
    key: 'ka',
    label: 'inceptive / future (ka)',
    suffix: 'ka',
    register: 'neutral',
    note: '"Ka ___" — flexible: marks a future action, an inception, or a habitual. "Ka kite anō" = "see (you) again" is this particle.',
    miFrom: v => `Ka ${v.base} au`,
    pronFrom: v => `KAH ${v.pron} OW`,
    enFrom:   v => `I will ${verbBase(v)}`,
  },
  {
    key: 'me',
    label: 'should (me)',
    suffix: 'me',
    register: 'neutral',
    note: '"Me ___" — soft "should". Used for polite suggestions and gentle directives.',
    miFrom: v => `Me ${v.base} au`,
    pronFrom: v => `MEH ${v.pron} OW`,
    enFrom:   v => `I should ${verbBase(v)}`,
  },
];

// Stative-adjective patterns — these don't use the same particles.
const ADJ_PATTERNS = [
  {
    key: 'he-stative',
    label: 'stative present',
    suffix: 'st',
    register: 'neutral',
    note: 'Statives ("be ___") are framed with "He ___" + subject. No tense particle is needed — context supplies the time.',
    miFrom: v => `He ${v.base} tēnei`,
    pronFrom: v => `HEH ${v.pron} TAY-nay`,
    enFrom:   v => `This is ${adjStem(v)}`,
  },
  {
    key: 'kei-te-stative',
    label: 'present continuous of state',
    suffix: 'kts',
    register: 'neutral',
    note: 'Statives can ALSO use "kei te ___" to emphasise a current state ("I am being / feeling ___").',
    miFrom: v => `Kei te ${v.base} au`,
    pronFrom: v => `KAY teh ${v.pron} OW`,
    enFrom:   v => `I am ${adjStem(v)}`,
  },
  {
    key: 'kua-stative',
    label: 'become (kua)',
    suffix: 'kus',
    register: 'neutral',
    note: 'For statives, "kua ___" marks a change-of-state — "have become ___".',
    miFrom: v => `Kua ${v.base} au`,
    pronFrom: v => `KOO-ah ${v.pron} OW`,
    enFrom:   v => `I have become ${adjStem(v)}`,
  },
];

module.exports.VERB_PATTERNS = VERB_PATTERNS;
module.exports.ADJ_PATTERNS  = ADJ_PATTERNS;

// Public API: produce { id, mi, en, pron, type, unit, pos, tags, register, note,
// verb_root, conjugation_key } for each pattern × verb.
module.exports.generatePatterns = function generatePatterns(VERBS) {
  const out = [];
  for (const v of VERBS) {
    const patterns = v.pos === 'adjective' ? ADJ_PATTERNS : VERB_PATTERNS;
    for (const p of patterns) {
      out.push({
        id: 'mi-pat-' + v.base.replace(/[^a-zāēīōū]/gi, '') + '-' + p.suffix,
        mi: p.miFrom(v),
        en: p.enFrom(v),
        pron: p.pronFrom(v),
        type: 'conjugation', // re-using the schema's "conjugation" type for tense patterns
        unit: v.unit,
        pos: v.pos,
        tags: ['tense-pattern', p.key],
        register: p.register,
        note: p.note,
        verb_root: v.base,
        conjugation_key: p.key,
      });
    }
  }
  return out;
};
