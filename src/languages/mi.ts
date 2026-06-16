import type { LanguageConfig } from '../data/languages';
import type { CardWithState, ErrorType, ExerciseType } from '../types';
import type { LanguageAdapter, SpecialExerciseCandidate } from './types';
import { createBaseAdapter, genericScaffoldHint } from './shared';
import { genericClassifyError, normalizedEditRatio } from './errorUtils';
import { normalize as norm } from '../utils/normalize';

const TENSE_HINTS: Record<string, string> = {
  'kei-te': 'Kei te marks an action happening now: kei te + verb + subject.',
  'e-ana': 'E ... ana is a continuous frame. The verb sits between e and ana.',
  kua: 'Kua marks a completed action or a change of state: "has/have" or "has become".',
  i: 'I before the verb marks a past event. Position tells it apart from other uses of i.',
  ka: 'Ka is flexible: future, inceptive, or habitual depending on context.',
  me: 'Me before a verb expresses should/ought to: a useful advice or obligation frame.',
  kia: 'Kia before a verb can express purpose, desired action, or a soft command: "so that / should".',
  'kaore-e': 'Kaore ... e is a common negative frame. The subject sits between kaore and e.',
  'kaua-e': 'Kaua ... e forms negative commands or warnings: "do not / should not".',
  he: 'He + stative/adjective frames a present state without a separate tense particle.',
  'kei-te-stative': 'Kei te with a stative emphasizes a current state or feeling.',
  'kua-stative': 'Kua with a stative marks a change of state: "has become".',
};

function keyBase(conjugationKey: string): string {
  if (conjugationKey.startsWith('mi:')) {
    return conjugationKey.split(':')[1] ?? conjugationKey;
  }
  const parts = conjugationKey.split('-');
  if (parts[0] === 'kei' && parts[1] === 'te' && parts[2] === 'stative') return 'kei-te-stative';
  if (parts[0] === 'kei' && parts[1] === 'te') return 'kei-te';
  if (parts[0] === 'e' && parts[1] === 'ana') return 'e-ana';
  if (parts[0] === 'kaore' && parts[1] === 'e') return 'kaore-e';
  if (parts[0] === 'kaua' && parts[1] === 'e') return 'kaua-e';
  if (parts[0] === 'kua' && parts[1] === 'stative') return 'kua-stative';
  return parts[0];
}

function grammarHint(card: CardWithState): string | null {
  if (card.type === 'conjugation' && card.conjugation_key) {
    return TENSE_HINTS[keyBase(card.conjugation_key)] ?? null;
  }
  if (card.tags.includes('tense-pattern')) {
    const tag = card.tags.find(t => TENSE_HINTS[t]);
    return tag ? TENSE_HINTS[tag] : 'Te reo Maori marks tense and aspect with particles around the verb rather than changing the verb itself.';
  }
  if (card.tags.includes('possessive')) {
    return 'Possessives in te reo Maori distinguish a/o categories; the relationship type matters, not just ownership.';
  }
  if (card.tags.includes('macron') || /[āēīōū]/i.test(card.swahili)) {
    return 'Macrons mark long vowels. They can change meaning, so treat them as part of the spelling.';
  }
  return null;
}

function scaffoldHint(card: CardWithState): string | undefined {
  if (card.type === 'conjugation' && card.conjugation_key) {
    return keyBase(card.conjugation_key).replace(/-/g, ' ');
  }
  if (card.tags.includes('tense-pattern')) return 'tense particle';
  return genericScaffoldHint(card);
}

const PARTICLE_MARKERS: Record<string, string[]> = {
  'kei-te': ['kei te'],
  'e-ana': ['e', 'ana'],
  kua: ['kua'],
  i: ['i'],
  ka: ['ka'],
  me: ['me'],
  kia: ['kia'],
  'kaore-e': ['kaore', 'kāore', 'e'],
  'kaua-e': ['kaua', 'e'],
  he: ['he'],
  'kei-te-stative': ['kei te'],
  'kua-stative': ['kua'],
};

function stripMacrons(s: string): string {
  return s
    .replace(/[āĀ]/g, 'a')
    .replace(/[ēĒ]/g, 'e')
    .replace(/[īĪ]/g, 'i')
    .replace(/[ōŌ]/g, 'o')
    .replace(/[ūŪ]/g, 'u');
}

function classifyError(card: CardWithState, given: string): ErrorType | null {
  if (normalizedEditRatio(card.swahili, given) <= 0.25) return 'phonological';

  if (stripMacrons(card.swahili).toLowerCase() === stripMacrons(given).toLowerCase() && card.swahili !== given) {
    return 'phonological';
  }

  if (card.type === 'conjugation' && card.conjugation_key) {
    const key = keyBase(card.conjugation_key);
    const expected = PARTICLE_MARKERS[key] ?? [];
    const wrong = norm(stripMacrons(given));
    const correct = norm(stripMacrons(card.swahili));
    const sharesVerbRoot = !!card.verb_root && wrong.includes(norm(stripMacrons(card.verb_root)));
    const hasExpectedFrame = expected.every(marker => wrong.includes(norm(stripMacrons(marker))));

    if (sharesVerbRoot && !hasExpectedFrame) return 'structural';

    const correctTokens = correct.split(/\s+/);
    const wrongTokens = wrong.split(/\s+/);
    const overlap = correctTokens.filter(token => token.length >= 2 && wrongTokens.includes(token)).length;
    if (overlap >= Math.max(1, Math.floor(correctTokens.length / 2)) && !hasExpectedFrame) return 'structural';
  }

  return genericClassifyError(card, given);
}

function specialExercises(
  card: CardWithState,
  baseExercise: ExerciseType,
  level: 1 | 2 | 3 | 4 | 5,
): SpecialExerciseCandidate[] {
  if (
    baseExercise === 'multiple_choice' &&
    level >= 3 &&
    card.type === 'conjugation' &&
    card.tags.includes('tense-pattern') &&
    !!card.conjugation_key
  ) {
    return [{ exercise: 'maori_tense', level: 3 }];
  }
  return [];
}

export function createMaoriAdapter(config: LanguageConfig): LanguageAdapter {
  return {
    ...createBaseAdapter(config),
    grammarHint,
    scaffoldHint,
    classifyError,
    specialExercises,
  };
}
