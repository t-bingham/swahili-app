import { getIntroducedCards } from '../database/db';
import type { CardWithState } from '../types';

// ─── Weight functions ─────────────────────────────────────────────────────────

// Shallower depth = higher base weight
function depthWeight(depth: number): number {
  if (depth <= 2)    return 5.0;
  if (depth <= 3)    return 2.5;
  if (depth <= 4)    return 1.0;
  if (depth <= 5.1)  return 0.5;
  if (depth <= 5.2)  return 0.25;
  return 0.1;
}

// Linear fraction of time elapsed toward next_review.
// 0.05 = just reviewed, 1.0 = due now, up to 1.5 = overdue
function timeFraction(card: CardWithState, nowMs: number): number {
  if (!card.state.last_review || !card.state.next_review) return 0.5;
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

export function drawWeightedCard(
  pool: CardWithState[],
  nowMs: number,
  excludeId?: string,
): CardWithState | null {
  if (!pool.length) return null;

  const eligible = excludeId ? pool.filter(c => c.id !== excludeId) : pool;
  if (!eligible.length) return pool[0];

  const weights = eligible.map(c => cardWeight(c, nowMs));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total === 0) return eligible[Math.floor(Math.random() * eligible.length)];

  let r = Math.random() * total;
  for (let i = 0; i < eligible.length; i++) {
    r -= weights[i];
    if (r <= 0) return eligible[i];
  }
  return eligible[eligible.length - 1];
}

// ─── Pool loader ──────────────────────────────────────────────────────────────

export async function buildPracticePool(): Promise<CardWithState[]> {
  return getIntroducedCards();
}
