import { describe, expect, it } from 'vitest';
import { normalize } from '../src/utils/normalize';
import { computeLessons } from '../src/utils/lessons';
import { computeStatus } from '../src/utils/unitStatus';
import type { Unit, UnitProgress } from '../src/types';
import { makeCard } from './factories';

describe('normalize', () => {
  it('lowercases, trims, and removes punctuation', () => {
    expect(normalize('  Mambo!  ')).toBe('mambo');
    expect(normalize("What's up?")).toBe('whats up');
  });
});

describe('computeStatus', () => {
  const unit: Unit = {
    id: 'unit-02',
    name: 'Basics',
    description: '',
    level: 1,
    order_index: 2,
    prerequisite_ids: ['unit-01'],
    grammar_notes: '',
    estimated_hours: 1,
  };

  it('locks a unit until prerequisites are completed', () => {
    expect(computeStatus(unit, new Map())).toBe('locked');
  });

  it('returns available once prerequisites are complete', () => {
    const progress: UnitProgress = {
      unit_id: 'unit-01',
      status: 'completed',
      started_at: null,
      completed_at: '2026-05-26T00:00:00.000Z',
      mastery_score: 100,
    };
    expect(computeStatus(unit, new Map([[progress.unit_id, progress]]))).toBe('available');
  });

  it('preserves in-progress and completed state for the unit itself', () => {
    const selfProgress: UnitProgress = {
      unit_id: 'unit-02',
      status: 'in_progress',
      started_at: '2026-05-26T00:00:00.000Z',
      completed_at: null,
      mastery_score: 40,
    };
    expect(computeStatus(unit, new Map([[selfProgress.unit_id, selfProgress]]))).toBe('in_progress');
  });
});

describe('computeLessons', () => {
  it('sorts by frequency rank, chunks into lessons, and locks later lessons until prior cards are introduced', () => {
    const cards = Array.from({ length: 10 }, (_, index) =>
      makeCard({
        id: `card-${index + 1}`,
        frequency_rank: 10 - index,
        state: { card_id: `card-${index + 1}`, depth_level: 1 },
      }),
    );

    const lessons = computeLessons(cards);

    expect(lessons).toHaveLength(2);
    expect(lessons[0].cards.map(card => card.frequency_rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(lessons[0].status).toBe('available');
    expect(lessons[1].status).toBe('locked');
  });

  it('marks introduced lessons complete and depth-3 lessons mastered', () => {
    const introduced = Array.from({ length: 8 }, (_, index) =>
      makeCard({
        id: `intro-${index}`,
        frequency_rank: index + 1,
        state: { card_id: `intro-${index}`, depth_level: 2 },
      }),
    );
    const mastered = introduced.map(card => ({
      ...card,
      id: `mastered-${card.id}`,
      state: { ...card.state, card_id: `mastered-${card.id}`, depth_level: 3 as const },
    }));

    expect(computeLessons(introduced)[0].status).toBe('complete');
    expect(computeLessons(mastered)[0].status).toBe('mastered');
  });
});
