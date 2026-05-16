import type { CardWithState } from '../types';

export function scaffoldLevel(
  card: CardWithState,
  skillMastery: Map<string, number>,
): 1 | 2 | 3 | 4 | 5 {
  const known = card.tags.filter(t => skillMastery.has(t));
  if (!known.length) return 5; // no data → maximum support
  const mastery = known.reduce((s, t) => s + skillMastery.get(t)!, 0) / known.length;
  if (mastery < 0.20) return 5;
  if (mastery < 0.40) return 4;
  if (mastery < 0.60) return 3;
  if (mastery < 0.80) return 2;
  return 1;
}

export function scaffoldHint(card: CardWithState): string | undefined {
  if (card.noun_class) return `${card.noun_class} noun`;
  if (card.verb_root) return `verb: ${card.verb_root}`;
  if (card.type === 'conjugation' && card.conjugation_key) {
    const [, subj, tense] = card.conjugation_key.split(':');
    return `${subj} — ${tense?.replace(/_/g, ' ')}`;
  }
  const contentTag = card.tags.find(t => !['conjugation','infinitive','production','plural','fill-blank'].includes(t));
  return contentTag;
}
