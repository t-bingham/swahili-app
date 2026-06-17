import { describe, expect, it } from 'vitest';
import { normalize } from '../src/utils/normalize';
import { computeLessons } from '../src/utils/lessons';
import { computeStatus } from '../src/utils/unitStatus';
import { unitBasePath, unitDisplayLabel, unitsForTrack } from '../src/utils/unitTracks';
import { parseConcord } from '../src/components/exercises/ConcordExercise';
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

describe('unitTracks', () => {
  const units: Unit[] = [
    {
      id: 'unit-00-placement',
      name: 'Placement',
      description: '',
      level: 1,
      order_index: 0,
      prerequisite_ids: [],
      grammar_notes: '',
      estimated_hours: 0,
    },
    {
      id: 'unit-01',
      name: 'Greetings',
      description: '',
      level: 1,
      order_index: 1,
      prerequisite_ids: [],
      grammar_notes: '',
      estimated_hours: 1,
      track: 'vocabulary',
    },
    {
      id: 'unit-07',
      name: 'Noun Classes',
      description: '',
      level: 1,
      order_index: 7,
      prerequisite_ids: [],
      grammar_notes: '',
      estimated_hours: 1,
      track: 'grammar',
    },
    {
      id: 'unit-08',
      name: 'Present Tense',
      description: '',
      level: 2,
      order_index: 8,
      prerequisite_ids: ['unit-07'],
      grammar_notes: '',
      estimated_hours: 1,
      track: 'grammar',
    },
    {
      id: 'unit-12',
      name: 'Travel',
      description: '',
      level: 2,
      order_index: 12,
      prerequisite_ids: ['unit-01'],
      grammar_notes: '',
      estimated_hours: 1,
      track: 'vocabulary',
    },
  ];

  it('rebases unit numbering within each tab', () => {
    expect(unitsForTrack(units, 'vocabulary').map(u => u.id)).toEqual(['unit-01', 'unit-12']);
    expect(unitsForTrack(units, 'grammar').map(u => u.id)).toEqual(['unit-07', 'unit-08']);
    expect(unitDisplayLabel(units, units[1])).toBe('Unit 1');
    expect(unitDisplayLabel(units, units[2])).toBe('Grammar 1');
    expect(unitDisplayLabel(units, units[3])).toBe('Grammar 2');
    expect(unitDisplayLabel(units, units[4])).toBe('Unit 2');
  });

  it('routes grammar units to the grammar tab', () => {
    expect(unitBasePath(units[1])).toBe('/app/units');
    expect(unitBasePath(units[2])).toBe('/app/grammar');
  });
});

describe('parseConcord', () => {
  it('returns null for non-concord cards', () => {
    expect(parseConcord(makeCard())).toBeNull();
  });

  it('parses adjective agreement cards', () => {
    const card = makeCard({
      id: 'adj:watu:-zuri',
      swahili: 'watu wazuri',
      english: 'good people',
      type: 'grammar',
      tags: ['adjective-agreement'],
    });

    expect(parseConcord(card)).toEqual({
      noun: 'watu',
      answer: 'wazuri',
      stem: 'zuri',
      meaning: 'good',
    });
  });
});
