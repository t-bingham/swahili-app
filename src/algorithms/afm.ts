import type { CardWithState } from '../types';

export function scaffoldLevel(
  card: CardWithState,
  skillMastery: Map<string, number>,
): 1 | 2 | 3 | 4 | 5 {
  const known = card.tags.filter(t => skillMastery.has(t));
  if (!known.length) return 5; // no data → maximum support
  const mastery = known.reduce((s, t) => s + skillMastery.get(t)!, 0) / known.length;
  let level: 1 | 2 | 3 | 4 | 5;
  if (mastery < 0.20) level = 5;
  else if (mastery < 0.40) level = 4;
  else if (mastery < 0.60) level = 3;
  else if (mastery < 0.80) level = 2;
  else level = 1;

  // Topic tags (e.g. 'nouns', 'food') are shared across many cards and can
  // inflate mastery for recently introduced cards. Clamp the level so new/learning
  // cards can't jump straight to production:
  //   depth < 3 (new / learning / young) → at most multiple_choice (level ≥ 3)
  //   depth ≥ 3 (known+)                  → no clamp (cloze / type_answer can appear)
  // (Previously clamped through depth 3 inclusive, which starved sessions of
  //  variety — even known cards never progressed past multiple_choice.)
  const depth = card.state.depth_level;
  if (depth < 3 && level < 3) level = 3;

  return level;
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
