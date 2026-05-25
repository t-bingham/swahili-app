import type { CardWithState, DepthLevel } from '../src/types';

export function makeCard(overrides: Partial<CardWithState> = {}): CardWithState {
  const depth = overrides.state?.depth_level ?? 2;
  return {
    id: 'card-1',
    swahili: 'jambo',
    english: 'hello',
    pronunciation: 'JAM-bo',
    type: 'vocabulary',
    tags: ['greetings'],
    base_difficulty: 0.3,
    frequency_rank: 1,
    quick_learn: false,
    unit_id: 'unit-01',
    source: 'handwritten',
    example_sentences: [],
    placement_only: false,
    ...overrides,
    state: {
      card_id: overrides.id ?? 'card-1',
      depth_level: depth as DepthLevel,
      stability: 1,
      difficulty: 0.3,
      retrievability: 1,
      last_review: null,
      next_review: null,
      review_count: 0,
      lapse_count: 0,
      consecutive_correct: 0,
      fast_learn_level: 0,
      fast_learn_fail_count: 0,
      response_time_avg_ms: null,
      starred: false,
      ...overrides.state,
    },
  };
}
