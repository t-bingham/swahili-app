import { getIntroducedCards, getNewCards } from '../database/db';
import type { CardWithState } from '../types';

// ─── Weight functions ─────────────────────────────────────────────────────────

// Shallower depth = higher base weight. Depth 1 (new, unseen) gets a strong
// but not dominant weight so new words appear regularly without flooding reviews.
function depthWeight(depth: number): number {
  if (depth < 2)     return 4.0; // new / unseen
  if (depth <= 2)    return 5.0; // learning
  if (depth <= 3)    return 2.5; // young
  if (depth <= 4)    return 1.0; // established
  if (depth <= 5.1)  return 0.5;
  if (depth <= 5.2)  return 0.25;
  return 0.1;
}

// Linear fraction of time elapsed toward next_review.
// New cards (no schedule yet) are treated as fully due.
// 0.05 = just reviewed, 1.0 = due now, up to 1.5 = overdue
function timeFraction(card: CardWithState, nowMs: number): number {
  if (!card.state.last_review || !card.state.next_review) return 1.0;
  const lastMs = new Date(card.state.last_review).getTime();
  const nextMs = new Date(card.state.next_review).getTime();
  const scheduled = nextMs - lastMs;
  if (scheduled <= 0) return 1.5;
  return Math.max(0.05, Math.min(1.5, (nowMs - lastMs) / scheduled));
}

export function cardWeight(card: CardWithState, nowMs: number): number {
  return depthWeight(card.state.depth_level) * timeFraction(card, nowMs);
}

// ─── Weighted draw ────────────────────────────────────────────────────────────

function weightedDraw(candidates: CardWithState[], nowMs: number): CardWithState {
  const weights = candidates.map(c => cardWeight(c, nowMs));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total === 0) return candidates[Math.floor(Math.random() * candidates.length)];
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

export function drawWeightedCard(
  pool: CardWithState[],
  nowMs: number,
  excludeId?: string,
  newWordRate = 0, // 0–100: % chance of drawing a new (depth-1) card
): CardWithState | null {
  if (!pool.length) return null;

  const eligible = excludeId ? pool.filter(c => c.id !== excludeId) : pool;
  if (!eligible.length) return pool[0];

  if (newWordRate > 0) {
    const newCards    = eligible.filter(c => c.state.depth_level === 1);
    const reviewCards = eligible.filter(c => c.state.depth_level !== 1);

    if (newCards.length > 0 && Math.random() * 100 < newWordRate) {
      return newCards[Math.floor(Math.random() * newCards.length)];
    }
    if (reviewCards.length > 0) return weightedDraw(reviewCards, nowMs);
    return newCards[Math.floor(Math.random() * newCards.length)];
  }

  return weightedDraw(eligible, nowMs);
}

// ─── Pool loader ──────────────────────────────────────────────────────────────

export async function buildPracticePool(
  mode: 'review' | 'learn' = 'review',
): Promise<CardWithState[]> {
  const introduced = await getIntroducedCards();
  if (mode === 'review') return introduced;

  // In learn mode, seed the pool with a handful of unlearned cards so they
  // surface naturally through the same weighted draw (depth 1 → weight 4.0).
  const newCards = await getNewCards(10);
  return [...introduced, ...newCards];
}
