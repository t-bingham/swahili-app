import type { LearningGoal } from '../types';

// Tag-weight multipliers applied in session assembly (C-06).
// A card whose tags overlap with the user's goal receives the highest matching multiplier.
// Tags not listed default to 1.0 (no change).
export const GOAL_TAG_WEIGHTS: Record<LearningGoal, Record<string, number>> = {
  travel_survival: {
    greetings:  2.0,
    numbers:    2.0,
    transport:  1.8,
    food:       1.8,
    health:     1.5,
    time:       1.5,
  },
  live_in_country: {
    greetings:    1.8,
    'daily-life': 2.0,
    housing:      1.8,
    health:       1.6,
    numbers:      1.5,
    community:    1.8,
    family:       1.5,
    food:         1.5,
    transport:    1.5,
  },
  family_community: {
    family:    2.0,
    greetings: 1.8,
    emotions:  1.6,
    proverbs:  1.5,
    food:      1.4,
    community: 1.6,
  },
  business_professional: {
    'formal-register': 2.0,
    numbers:           1.8,
    professions:       1.8,
    greetings:         1.5,
    transport:         1.4,
  },
  academic_literary: {
    // No overrides — full curriculum weight applies equally
  },
  cultural_curiosity: {
    proverbs:  2.0,
    culture:   2.0,
    idioms:    1.8,
    religion:  1.5,
    history:   1.5,
    greetings: 1.3,
  },
};

// Returns the highest-priority goal multiplier for a given set of card tags.
export function goalMultiplierForCard(
  tags: string[],
  goal: LearningGoal,
): number {
  const weights = GOAL_TAG_WEIGHTS[goal];
  return tags.reduce((max, tag) => Math.max(max, weights[tag] ?? 1.0), 1.0);
}
