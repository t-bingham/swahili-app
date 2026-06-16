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
 *    Kia kai au              — let me eat / that I eat
 *    Kāore au e kai          — I do not eat
 *    Kaua au e kai           — I should not eat / don't let me eat
 *
 * For stative adjectives, "He ___" frames the present, "I ___ ana" the past:
 *
 *    He pai tēnei            — This is good
 *    He pai tēnei i tērā wā  — This was good then  (using a time phrase; the
 *                                                    stative itself stays "He pai")
 *
 * So we generate each particle frame across a small set of high-value pronouns,
 * plus a small set of stative patterns for adjectives. This keeps the cards useful
 * rather than count-inflated: learners practise the same frame with au, koe, ia,
 * tātou, koutou, and rātou.
 *
 * Native-speaker review can tune individual English renderings later — the
 * structural pattern is what we're teaching here.
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

const SUBJECTS = [
  { key: 'au',     mi: 'au',     enSubject: 'I',      enObject: 'me',      pron: 'OW' },
  { key: 'koe',    mi: 'koe',    enSubject: 'you',    enObject: 'you',     pron: 'KOH-eh' },
  { key: 'ia',     mi: 'ia',     enSubject: 'he/she', enObject: 'him/her', pron: 'EE-ah' },
  { key: 'tatou',  mi: 'tātou',  enSubject: 'we',     enObject: 'us',      pron: 'TAH-toh' },
  { key: 'koutou', mi: 'koutou', enSubject: 'you all', enObject: 'you all', pron: 'KOH-toh' },
  { key: 'ratou',  mi: 'rātou',  enSubject: 'they',   enObject: 'them',    pron: 'RAH-toh' },
];

function beForm(subject) {
  if (subject.enSubject === 'I') return 'am';
  if (subject.enSubject === 'he/she') return 'is';
  return 'are';
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
    note: 'Present continuous with "kei te ___" — the most everyday tense frame in te reo.',
    miFrom: (v, s) => `Kei te ${v.base} ${s.mi}`,
    pronFrom: (v, s) => `KAY teh ${v.pron} ${s.pron}`,
    enFrom:   (v, s) => `${s.enSubject} ${beForm(s)} ${gerundOf(verbBase(v))}`,
  },
  {
    key: 'e-ana',
    label: 'present continuous (e ___ ana)',
    suffix: 'ea',
    register: 'neutral',
    note: 'Continuous frame using "e ___ ana" — close in meaning to "kei te ___". Common in narrative and song.',
    miFrom: (v, s) => `E ${v.base} ana ${s.mi}`,
    pronFrom: (v, s) => `EH ${v.pron} AH-nah ${s.pron}`,
    enFrom:   (v, s) => `${s.enSubject} ${beForm(s)} ${gerundOf(verbBase(v))} (currently)`,
  },
  {
    key: 'kua',
    label: 'perfective (kua)',
    suffix: 'ku',
    register: 'neutral',
    note: 'Perfective — "kua ___" marks a completed action or change of state ("I have ___-ed", "it has become ___").',
    miFrom: (v, s) => `Kua ${v.base} ${s.mi}`,
    pronFrom: (v, s) => `KOO-ah ${v.pron} ${s.pron}`,
    enFrom:   (v, s) => `${s.enSubject} ${s.enSubject === 'he/she' ? 'has' : 'have'} ${participleOf(verbBase(v))}`,
  },
  {
    key: 'i',
    label: 'past (i)',
    suffix: 'pa',
    register: 'neutral',
    note: 'Past tense — "i ___" marks a past event. ("Past" i is distinct from object-marker i, told apart by position.)',
    miFrom: (v, s) => `I ${v.base} ${s.mi}`,
    pronFrom: (v, s) => `EE ${v.pron} ${s.pron}`,
    enFrom:   (v, s) => `${s.enSubject} ${pastOf(verbBase(v))}`,
  },
  {
    key: 'ka',
    label: 'inceptive / future (ka)',
    suffix: 'ka',
    register: 'neutral',
    note: '"Ka ___" — flexible: marks a future action, an inception, or a habitual. "Ka kite anō" = "see (you) again" is this particle.',
    miFrom: (v, s) => `Ka ${v.base} ${s.mi}`,
    pronFrom: (v, s) => `KAH ${v.pron} ${s.pron}`,
    enFrom:   (v, s) => `${s.enSubject} will ${verbBase(v)}`,
  },
  {
    key: 'me',
    label: 'should (me)',
    suffix: 'me',
    register: 'neutral',
    note: '"Me ___" — soft "should". Used for polite suggestions and gentle directives.',
    miFrom: (v, s) => `Me ${v.base} ${s.mi}`,
    pronFrom: (v, s) => `MEH ${v.pron} ${s.pron}`,
    enFrom:   (v, s) => `${s.enSubject} should ${verbBase(v)}`,
  },
  {
    key: 'kia',
    label: 'subjunctive / desired action (kia)',
    suffix: 'kia',
    register: 'neutral',
    note: '"Kia ___" marks a desired, intended, or commanded action: "let/may/that someone ___". It appears in blessings, instructions, and purpose clauses.',
    miFrom: (v, s) => `Kia ${v.base} ${s.mi}`,
    pronFrom: (v, s) => `KEE-ah ${v.pron} ${s.pron}`,
    enFrom:   (v, s) => `let ${s.enObject} ${verbBase(v)}`,
  },
  {
    key: 'kaore-e',
    label: 'negative present / general (kāore ... e)',
    suffix: 'neg',
    register: 'neutral',
    note: '"Kāore ... e ___" is a common negative frame: "does not / do not ___". The subject sits between kāore and e.',
    miFrom: (v, s) => `Kāore ${s.mi} e ${v.base}`,
    pronFrom: (v, s) => `KAH-oh-reh ${s.pron} EH ${v.pron}`,
    enFrom:   (v, s) => `${s.enSubject} ${s.enSubject === 'he/she' ? 'does not' : 'do not'} ${verbBase(v)}`,
  },
  {
    key: 'kaua-e',
    label: 'negative command / should not (kaua ... e)',
    suffix: 'kaua',
    register: 'neutral',
    note: '"Kaua ... e ___" forms negative commands or warnings: "do not ___ / should not ___".',
    miFrom: (v, s) => `Kaua ${s.mi} e ${v.base}`,
    pronFrom: (v, s) => `KOW-ah ${s.pron} EH ${v.pron}`,
    enFrom:   (v, s) => `${s.enSubject} should not ${verbBase(v)}`,
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
    miFrom: (v, s) => `Kei te ${v.base} ${s.mi}`,
    pronFrom: (v, s) => `KAY teh ${v.pron} ${s.pron}`,
    enFrom:   (v, s) => `${s.enSubject} ${beForm(s)} ${adjStem(v)}`,
  },
  {
    key: 'kua-stative',
    label: 'become (kua)',
    suffix: 'kus',
    register: 'neutral',
    note: 'For statives, "kua ___" marks a change-of-state — "have become ___".',
    miFrom: (v, s) => `Kua ${v.base} ${s.mi}`,
    pronFrom: (v, s) => `KOO-ah ${v.pron} ${s.pron}`,
    enFrom:   (v, s) => `${s.enSubject} ${s.enSubject === 'he/she' ? 'has' : 'have'} become ${adjStem(v)}`,
  },
];

module.exports.VERB_PATTERNS = VERB_PATTERNS;
module.exports.ADJ_PATTERNS  = ADJ_PATTERNS;

// Public API: produce { id, mi, en, pron, type, unit, pos, tags, register, note,
// verb_root, conjugation_key } for each pattern × verb.
module.exports.generatePatterns = function generatePatterns(VERBS) {
  const out = [];
  function normalizedTags(pattern, subject) {
    const tags = ['tense-pattern', 'grammar:tense', 'pattern:' + pattern.key, 'subject:' + subject.key];
    if (pattern.key.includes('kāore') || pattern.key.includes('kaua')) tags.push('grammar:negative');
    if (pattern.key.includes('stative')) tags.push('grammar:stative');
    return [...new Set(tags)];
  }
  for (const v of VERBS) {
    const patterns = v.pos === 'adjective' ? ADJ_PATTERNS : VERB_PATTERNS;
    for (const p of patterns) {
      const subjects = v.pos === 'adjective' && p.key === 'he-stative'
        ? [{ key: 'tenei', mi: 'tēnei', enSubject: 'this', pron: 'TAY-nay' }]
        : SUBJECTS;
      for (const s of subjects) {
        out.push({
          id: 'mi-pat-' + v.base.replace(/[^a-zāēīōū]/gi, '') + '-' + p.suffix + '-' + s.key,
          mi: p.miFrom(v, s),
          en: p.enFrom(v, s),
          pron: p.pronFrom(v, s),
          type: 'conjugation', // re-using the schema's "conjugation" type for tense patterns
          unit: v.unit,
          pos: v.pos,
          tags: normalizedTags(p, s),
          register: p.register,
          note: p.note,
          verb_root: v.base,
          conjugation_key: 'mi:' + p.key + ':subject:' + s.key,
        });
      }
    }
  }
  return out;
};
