import type { CardWithState } from '../types';

export const PLACEMENT_MAX_QUESTIONS = 15;

// ─── Answer validation ────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/['']/g, "'");
}

export function validatePlacementAnswer(userAnswer: string, card: CardWithState): boolean {
  const ans = normalize(userAnswer);
  if (ans === normalize(card.english)) return true;
  if (card.senses) {
    for (const sense of card.senses) {
      if (ans === normalize(sense.english)) return true;
    }
  }
  return false;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface PlacementResult {
  orderIndex: number; // target unit.order_index — cards in units before this are marked mastered
  label:      string; // short descriptor shown on the result screen
}

// Binary-search placement: `lo` is the index into the placement card pool (sorted
// by frequency_rank) where the learner's knowledge ran out. `total` is pool size.
// Maps a position percentile to a curriculum order_index.
export function scorePlacementByPosition(lo: number, total: number): PlacementResult {
  const pct = total > 0 ? lo / total : 0;
  if (pct < 0.10) return { orderIndex: 0,  label: 'Beginner' };
  if (pct < 0.22) return { orderIndex: 4,  label: 'Early Beginner' };
  if (pct < 0.38) return { orderIndex: 8,  label: 'Beginner+' };
  if (pct < 0.52) return { orderIndex: 14, label: 'Lower Intermediate' };
  if (pct < 0.66) return { orderIndex: 20, label: 'Intermediate' };
  if (pct < 0.82) return { orderIndex: 27, label: 'Upper Intermediate' };
  return { orderIndex: 33, label: 'Advanced' };
}

// ─── Distractor generation ────────────────────────────────────────────────────

// Picks 3 distractors for a multiple-choice question.
//
// Key rule: distractors must share the same grammatical *form* as the correct answer,
// not just the same part of speech. For conjugation cards the english is a full clause
// ("he is eating") while vocabulary cards are infinitives ("to eat") — mixing them lets
// learners identify the answer by grammatical structure alone, without knowing Swahili.
export function pickDistractors(card: CardWithState, pool: CardWithState[]): string[] {
  const others = pool.filter(c => c.id !== card.id);
  const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

  let preferred: CardWithState[];
  let fallback: CardWithState[];

  if (card.type === 'conjugation') {
    // Must use other conjugations — bare infinitives immediately reveal the answer
    preferred = shuffle(others.filter(c => c.type === 'conjugation'));
    fallback  = shuffle(others.filter(c => c.type !== 'conjugation'));
  } else if (card.type === 'grammar') {
    preferred = shuffle(others.filter(c => c.type === 'grammar'));
    fallback  = shuffle(others.filter(c => c.type !== 'grammar'));
  } else {
    // Vocabulary / phrase: prefer same part of speech as before
    preferred = shuffle(others.filter(c => c.part_of_speech === card.part_of_speech));
    fallback  = shuffle(others.filter(c => c.part_of_speech !== card.part_of_speech));
  }

  return [...preferred, ...fallback].slice(0, 3).map(c => c.english);
}
