import { getIntroducedCards, getNewCards, getSkillMastery } from '../database/db';
import type { CardWithState, LearningGoal, ProfileSettings } from '../types';
import { goalMultiplierForCard } from '../utils/goalWeights';

// ─── Session modifiers ────────────────────────────────────────────────────────

// Computed once per session from the DB, then threaded through draw calls.
export interface SessionModifiers {
  errorRates: Map<string, number>; // skill_tag → error rate (0–1), derived from skill mastery
  goal?: LearningGoal;
}

// Call once when building a session. Reads skill mastery from DB and converts
// to error rates (1 − mastery). Cheap: one DB scan, cached for the session.
export async function loadSessionModifiers(goal?: LearningGoal): Promise<SessionModifiers> {
  const skillMastery = await getSkillMastery();
  const errorRates = new Map<string, number>();
  for (const [tag, mastery] of skillMastery) {
    errorRates.set(tag, 1 - mastery);
  }
  return { errorRates, goal };
}

// ─── Weight functions ─────────────────────────────────────────────────────────

// Shallower depth = higher base weight. Depth 1 (new, unseen) gets a strong
// but not dominant weight so new words appear regularly without flooding reviews.
function depthWeight(depth: number): number {
  if (depth < 2)    return 4.0; // new / unseen
  if (depth <= 2)   return 5.0; // learning
  if (depth <= 3)   return 2.5; // young
  if (depth <= 4)   return 1.0; // established
  if (depth <= 5.1) return 0.5;
  if (depth <= 5.2) return 0.25;
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

// Base weight — used externally by tests and the unit lesson screen.
export function cardWeight(card: CardWithState, nowMs: number): number {
  return depthWeight(card.state.depth_level) * timeFraction(card, nowMs);
}

// Full weight including ITS modifiers (C-01 error boost, C-06 goal priority, D-04 star boost).
// Falls back to base cardWeight when no modifiers are provided.
function fullCardWeight(
  card: CardWithState,
  nowMs: number,
  modifiers?: SessionModifiers,
): number {
  const base = cardWeight(card, nowMs);
  if (!modifiers) return base;

  // C-01: error boost — cards with high per-skill error rates surface more
  const avgErrorRate =
    card.tags.length > 0
      ? card.tags.reduce((sum, tag) => sum + (modifiers.errorRates.get(tag) ?? 0), 0) / card.tags.length
      : 0;
  const errorBoost = 1 + avgErrorRate * 0.5; // 1.0–1.5×

  // C-06: goal multiplier — cards aligned with the learner's goal get a priority bump
  const goalMult = modifiers.goal
    ? goalMultiplierForCard(card.tags, modifiers.goal)
    : 1.0;

  // D-04: star boost — explicitly starred cards get extra weight
  const starBoost = card.state.starred ? 1.4 : 1.0;

  return base * errorBoost * goalMult * starBoost;
}

// ─── Weighted draw ────────────────────────────────────────────────────────────

function weightedDraw(
  candidates: CardWithState[],
  nowMs: number,
  modifiers?: SessionModifiers,
  prevType?: string,
): CardWithState {
  // Interleaving (P2.4): down-weight cards of the same kind as the one just shown
  // so a session doesn't run long streaks of one skill (e.g. conjugation drills).
  // Interleaving on top of spaced repetition improves long-term retention.
  const weights = candidates.map(c => {
    const w = fullCardWeight(c, nowMs, modifiers);
    return prevType && c.type === prevType ? w * 0.4 : w;
  });
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
  modifiers?: SessionModifiers,
  prevType?: string, // card.type of the card just shown — for interleaving
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
    if (reviewCards.length > 0) return weightedDraw(reviewCards, nowMs, modifiers, prevType);
    return newCards[Math.floor(Math.random() * newCards.length)];
  }

  return weightedDraw(eligible, nowMs, modifiers, prevType);
}

// ─── Pool loader ──────────────────────────────────────────────────────────────

// C-04: grammar depth filter
// 'communication' — conjugation cards excluded entirely
// 'fluency'       — conjugation cards capped at 40% of pool (default behaviour)
// 'linguist'      — no filter
function applyGrammarDepthFilter(
  cards: CardWithState[],
  depth: ProfileSettings['grammar_depth'],
): CardWithState[] {
  if (depth === 'communication') {
    return cards.filter(c => c.type !== 'conjugation');
  }
  if (depth === 'fluency') {
    const nonConj = cards.filter(c => c.type !== 'conjugation');
    const conj    = cards.filter(c => c.type === 'conjugation');
    // Keep conjugations up to 40% of the total pool size
    const maxConj = Math.floor((nonConj.length / 0.6) * 0.4);
    return [...nonConj, ...conj.slice(0, maxConj)];
  }
  return cards; // 'linguist' or undefined — no filter
}

export async function buildPracticePool(
  mode: 'review' | 'learn' = 'review',
  settings?: Pick<ProfileSettings, 'grammar_depth'>,
): Promise<CardWithState[]> {
  const introduced = await getIntroducedCards();
  const filtered = applyGrammarDepthFilter(introduced, settings?.grammar_depth);

  if (mode === 'review') return filtered;

  // In learn mode, seed the pool with unlearned cards so they surface naturally
  // through the same weighted draw (depth 1 → weight 4.0).
  let newCards = await getNewCards(10);
  newCards = applyGrammarDepthFilter(newCards, settings?.grammar_depth);

  return [...filtered, ...newCards];
}
