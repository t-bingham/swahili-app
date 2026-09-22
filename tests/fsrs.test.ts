import { describe, expect, it } from 'vitest';
import {
  initialDifficulty,
  initialStability,
  learningIntervalMinutes,
  nextInterval,
  processReview,
  retrievability,
} from '../src/algorithms/fsrs';

describe('FSRS helpers', () => {
  it.each([1, 10, 100])('defines stability %s as the interval at 90 percent recall', stability => {
    expect(retrievability(stability, stability)).toBeCloseTo(0.9, 12);
    expect(nextInterval(stability, 0.9)).toBe(stability);
  });

  it.each([0.75, 0.85, 0.88, 0.95])('schedules back to the requested retention %s', retention => {
    const interval = nextInterval(100, retention);
    expect(retrievability(interval, 100)).toBeCloseTo(retention, 3);
  });

  it('keeps retrievability at 1 on review day and lower after time passes', () => {
    expect(retrievability(0, 10)).toBe(1);
    expect(retrievability(10, 10)).toBeLessThan(1);
  });

  it('maps learning ratings to expected minute intervals', () => {
    expect(learningIntervalMinutes(1)).toBe(1);
    expect(learningIntervalMinutes(2)).toBe(6);
    expect(learningIntervalMinutes(3)).toBe(10);
    expect(learningIntervalMinutes(4)).toBe(1440);
  });

  it('creates stronger initial stability for higher ratings', () => {
    expect(initialStability(4)).toBeGreaterThan(initialStability(1));
    expect(initialDifficulty(4)).toBeLessThan(initialDifficulty(1));
  });

  it('never schedules below one day for day-based intervals', () => {
    expect(nextInterval(0.01)).toBe(1);
  });

  it('processes new-card reviews without using stale retrievability', () => {
    const result = processReview({
      currentStability: 0,
      currentDifficulty: 0.3,
      daysSinceLastReview: 0,
      rating: 3,
      isNewCard: true,
    });

    expect(result.new_stability).toBeGreaterThan(0);
    expect(result.new_difficulty).toBeGreaterThanOrEqual(1);
    expect(result.retrievability_at_review).toBe(1);
    expect(result.next_interval_days).toBeGreaterThanOrEqual(1);
  });
});
