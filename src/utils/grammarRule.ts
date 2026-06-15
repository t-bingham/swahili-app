import type { CardWithState } from '../types';

// Concise, learner-facing rule shown on a wrong answer (elaborative feedback).
// Returns null for plain vocabulary, where the example sentence carries the load.
const TENSE_RULES: Record<string, string> = {
  present:          'Present tense: subject prefix + -na- + stem (ninasoma = "I read / am reading").',
  past:             'Past tense uses -li-: nilisoma = "I read".',
  future:           'Future uses -ta-: nitasoma = "I will read".',
  perfect:          'Perfect uses -me-: nimesoma = "I have read".',
  habitual:         'Habitual hu- is the same for every person: husoma.',
  subjunctive:      'Subjunctive ends in -e: nisome = "(that) I read".',
  conditional:      'Conditional uses -nge-: ningesoma = "I would read".',
  conditional_past: 'Past conditional uses -ngali-: ningalisoma = "I would have read".',
  neg_present:      'Negative present: si-/hu-/ha-… and the final -a becomes -i (sisomi).',
  neg_past:         'Negative past uses -ku-: sikusoma = "I didn\'t read".',
  neg_perfect:      'Negative perfect uses -ja- ("not yet"): sijasoma.',
};

export function grammarRule(card: CardWithState): string | null {
  if (card.type === 'conjugation' && card.conjugation_key) {
    return TENSE_RULES[card.conjugation_key.split(':')[2]] ?? null;
  }
  if (card.tags?.includes('adjective-agreement') && card.noun_class) {
    return `Adjectives agree with their noun's class — here, the ${card.noun_class} agreement prefix.`;
  }
  return null;
}
