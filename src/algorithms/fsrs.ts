// Direct copy — avoids cross-project @shared import chain in Vite

import type { FSRSResult } from '../types';

const FACTOR = 19 / 81;

const W: readonly number[] = [
  0.4072, 1.1829, 3.1262, 15.4722,
  7.2102, 0.5316, 1.0651, 0.0589,
  1.5330, 0.1544, 1.0070, 1.9395,
  0.1100, 0.2900, 2.2700, 0.2100,
  2.9898, 0.5100, 0.4300,
];

export function retrievability(t: number, S: number): number {
  return Math.pow(1 + FACTOR * (t / S), -1 / FACTOR);
}

export function nextInterval(S: number, targetRetention = 0.9): number {
  return Math.max(1, Math.round(S * Math.log(targetRetention) / Math.log(0.9)));
}

export function initialStability(rating: 1 | 2 | 3 | 4): number {
  return Math.max(0.1, W[rating - 1]);
}

export function initialDifficulty(rating: 1 | 2 | 3 | 4): number {
  return clamp(W[4] - Math.exp(W[5] * (rating - 1)) + 1);
}

export function updatedStability(S: number, D: number, R: number, rating: 1 | 2 | 3 | 4, successful: boolean): number {
  if (successful) {
    const hardPenalty = rating === 2 ? W[15] : 1;
    const easyBonus = rating === 4 ? W[16] : 1;
    return S * (Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * hardPenalty * easyBonus) + S;
  }
  return W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R));
}

export function updatedDifficulty(D: number, rating: 1 | 2 | 3 | 4): number {
  return clamp(D + W[6] * (-(rating - 3)) + W[7] * (10 - D) / 9);
}

export interface ReviewInput {
  currentStability: number;
  currentDifficulty: number;
  daysSinceLastReview: number;
  rating: 1 | 2 | 3 | 4;
  isNewCard: boolean;
  targetRetention?: number;
}

export function processReview(input: ReviewInput): FSRSResult {
  const { currentStability, currentDifficulty, daysSinceLastReview, rating, isNewCard, targetRetention = 0.9 } = input;
  let newS: number, newD: number;
  if (isNewCard) {
    newS = initialStability(rating);
    newD = initialDifficulty(rating);
  } else {
    const R = retrievability(daysSinceLastReview, currentStability);
    newS = Math.max(0.1, updatedStability(currentStability, currentDifficulty, R, rating, rating >= 3));
    newD = updatedDifficulty(currentDifficulty, rating);
  }
  return {
    new_stability: newS,
    new_difficulty: newD,
    next_interval_days: nextInterval(newS, targetRetention),
    retrievability_at_review: isNewCard ? 1.0 : retrievability(daysSinceLastReview, currentStability),
  };
}

export function learningIntervalMinutes(rating: 1 | 2 | 3 | 4): number {
  return [1, 6, 10, 1440][rating - 1];
}

function clamp(d: number): number {
  return Math.min(10, Math.max(1, d));
}
