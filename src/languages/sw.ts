import type { LanguageConfig } from '../data/languages';
import type { CardWithState, ErrorType, ExerciseType } from '../types';
import type { LanguageAdapter, SpecialExerciseCandidate } from './types';
import { createBaseAdapter } from './shared';
import { genericClassifyError, levenshtein } from './errorUtils';
import { normalize as norm } from '../utils/normalize';
import { ALL_NOUN_CLASSES } from '../data/nounClasses';
import { canSwahiliConcord } from './swahiliConcord';

const TENSE_RULES: Record<string, string> = {
  present: 'Present tense: subject prefix + -na- + stem (ninasoma = "I read / am reading").',
  past: 'Past tense uses -li-: nilisoma = "I read".',
  future: 'Future uses -ta-: nitasoma = "I will read".',
  perfect: 'Perfect uses -me-: nimesoma = "I have read".',
  habitual: 'Habitual hu- is the same for every person: husoma.',
  subjunctive: 'Subjunctive ends in -e: nisome = "(that) I read".',
  conditional: 'Conditional uses -nge-: ningesoma = "I would read".',
  conditional_past: 'Past conditional uses -ngali-: ningalisoma = "I would have read".',
  neg_present: 'Negative present: si-/hu-/ha-... and the final -a becomes -i (sisomi).',
  neg_past: 'Negative past uses -ku-: sikusoma = "I did not read".',
  neg_perfect: 'Negative perfect uses -ja- ("not yet"): sijasoma.',
};

function grammarHint(card: CardWithState): string | null {
  if (card.type === 'conjugation' && card.conjugation_key) {
    return TENSE_RULES[card.conjugation_key.split(':')[2]] ?? null;
  }
  if (card.tags?.includes('adjective-agreement') && card.noun_class) {
    return `Adjectives agree with their noun's class; here, the ${card.noun_class} agreement prefix.`;
  }
  return null;
}

function scaffoldHint(card: CardWithState): string | undefined {
  if (card.noun_class) return `${card.noun_class} noun`;
  if (card.verb_root) return `verb: ${card.verb_root}`;
  if (card.type === 'conjugation' && card.conjugation_key) {
    const [, subj, tense] = card.conjugation_key.split(':');
    return `${subj} - ${tense?.replace(/_/g, ' ')}`;
  }
  return card.tags.find(t => !['conjugation', 'infinitive', 'production', 'plural', 'fill-blank'].includes(t));
}

const SUBJECT_PREFIXES = ['si', 'hu', 'ha', 'tu', 'wa', 'ni', 'u', 'a', 'm'];
const TENSE_MARKERS = ['me', 'na', 'li', 'ta', 'ki', 'ka', 'ja'];
const OBJ_INFIXES = ['ni', 'ku', 'mu', 'tu', 'wa', 'ki', 'vi', 'i', 'zi', 'u', 'li', 'ya', 'lo'];

interface MorphemeSlots {
  subjectPrefix: string;
  tenseMarker: string;
  objInfix: string;
  root: string;
}

function parseMorphemes(word: string): MorphemeSlots | null {
  let rest = word.toLowerCase().trim().replace(/[^a-z]/g, '');
  if (rest.length < 3) return null;

  let subjectPrefix = '';
  for (const pfx of SUBJECT_PREFIXES) {
    if (rest.startsWith(pfx) && rest.length > pfx.length) {
      subjectPrefix = pfx;
      rest = rest.slice(pfx.length);
      break;
    }
  }
  if (!subjectPrefix) return null;

  let tenseMarker = '';
  for (const marker of TENSE_MARKERS) {
    if (rest.startsWith(marker) && rest.length > marker.length) {
      tenseMarker = marker;
      rest = rest.slice(marker.length);
      break;
    }
  }
  if (!tenseMarker) return null;

  let objInfix = '';
  for (const infix of OBJ_INFIXES) {
    if (rest.startsWith(infix) && rest.length - infix.length >= 3) {
      objInfix = infix;
      rest = rest.slice(infix.length);
      break;
    }
  }

  let root = rest;
  if (root.length > 2 && /[aeiou]$/.test(root)) root = root.slice(0, -1);
  if (root.length < 2) return null;

  return { subjectPrefix, tenseMarker, objInfix, root };
}

function classifyConjugationError(correctSwahili: string, wrongAnswer: string): ErrorType | null {
  const normCorrect = norm(correctSwahili);
  const normWrong = norm(wrongAnswer);

  const dist = levenshtein(normCorrect, normWrong);
  const maxLen = Math.max(normCorrect.length, normWrong.length, 1);
  if (dist <= 2 || dist / maxLen <= 0.25) return 'phonological';

  const correctSlots = parseMorphemes(normCorrect);
  const wrongSlots = parseMorphemes(normWrong);
  if (!correctSlots || !wrongSlots) return null;

  const rootDist = levenshtein(correctSlots.root, wrongSlots.root);
  const rootSimilar = rootDist / Math.max(correctSlots.root.length, wrongSlots.root.length, 1) <= 0.35;
  return rootSimilar ? 'structural' : 'semantic';
}

function classifyError(card: CardWithState, given: string): ErrorType | null {
  if (card.type === 'conjugation') {
    const morphemeResult = classifyConjugationError(card.swahili, given);
    if (morphemeResult) return morphemeResult;
  }
  return genericClassifyError(card, given);
}

function specialExercises(
  card: CardWithState,
  baseExercise: ExerciseType,
  level: 1 | 2 | 3 | 4 | 5,
): SpecialExerciseCandidate[] {
  if (canSwahiliConcord(card)) {
    return [{ exercise: 'concord', level: 3 }];
  }
  if (
    baseExercise === 'multiple_choice' &&
    card.type === 'vocabulary' &&
    card.noun_class &&
    (ALL_NOUN_CLASSES as readonly string[]).includes(card.noun_class) &&
    level >= 3
  ) {
    return [{ exercise: 'noun_class', level: 3, probability: 0.4 }];
  }
  return [];
}

export function createSwahiliAdapter(config: LanguageConfig): LanguageAdapter {
  return {
    ...createBaseAdapter(config),
    grammarHint,
    scaffoldHint,
    classifyError,
    specialExercises,
  };
}
