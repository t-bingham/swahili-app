import type { CardWithState } from '../types';

export const PLACEMENT_MAX_MISSES = 5;

// ─── Answer validation ────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/['']/g, "'");
}

// Returns true if userAnswer matches any accepted translation for the card.
// Checks the primary `english` field and every entry in `senses[]`.
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
  correct:    number;
  total:      number;
  orderIndex: number; // target unit.order_index — cards in units < this will be marked mastered
  label:      string; // short descriptor for the result screen
}

export function scorePlacement(correct: number): PlacementResult {
  if (correct < 5)  return { correct, total: correct, orderIndex: 0,  label: 'Beginner' };
  if (correct < 10) return { correct, total: correct, orderIndex: 4,  label: 'Early Beginner' };
  if (correct < 15) return { correct, total: correct, orderIndex: 8,  label: 'Beginner+' };
  if (correct < 25) return { correct, total: correct, orderIndex: 14, label: 'Lower Intermediate' };
  if (correct < 35) return { correct, total: correct, orderIndex: 20, label: 'Intermediate' };
  if (correct < 45) return { correct, total: correct, orderIndex: 27, label: 'Upper Intermediate' };
  return { correct, total: correct, orderIndex: 33, label: 'Advanced' };
}

// ─── Distractor generation ────────────────────────────────────────────────────

// Picks 3 distractors for a multiple-choice question from the placement pool.
// Prefers cards of the same part-of-speech so options feel plausible.
export function pickDistractors(card: CardWithState, pool: CardWithState[]): string[] {
  const others = pool.filter(c => c.id !== card.id);
  const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

  // Prefer same part_of_speech
  const samePOS = shuffle(others.filter(c => c.part_of_speech === card.part_of_speech));
  const rest    = shuffle(others.filter(c => c.part_of_speech !== card.part_of_speech));
  const ordered = [...samePOS, ...rest];

  return ordered.slice(0, 3).map(c => c.english);
}
