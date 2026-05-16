export type CardType = 'vocabulary' | 'phrase' | 'grammar' | 'conjugation';
export type ExerciseType = 'flashcard' | 'multiple_choice' | 'type_answer' | 'fill_blank';
export type ErrorType = 'phonological' | 'semantic' | 'structural';
export type SessionType = 1 | 2 | 3 | 4;
export type DepthLevel = 1 | 2 | 2.5 | 3 | 4 | 4.5 | 5.1 | 5.2 | 5.3;

export interface Card {
  id: string;
  swahili: string;
  english: string;
  pronunciation: string;
  type: CardType;
  tags: string[];
  noun_class?: string;
  verb_root?: string;
  conjugation_key?: string;
  base_difficulty: number;
  frequency_rank: number;
  quick_learn: boolean;
  unit_id: string;
  source: 'handwritten' | 'generated';
  prerequisite_card_id?: string;
  example_sentences: Array<{ swahili: string; english: string }>;
}

export interface CardState {
  card_id: string;
  depth_level: DepthLevel;
  stability: number;
  difficulty: number;
  retrievability: number;
  last_review: string | null;
  next_review: string | null;
  review_count: number;
  lapse_count: number;
  consecutive_correct: number;
  fast_learn_level: 0 | 2 | 4;
  fast_learn_fail_count: number;
}

export interface CardWithState extends Card {
  state: CardState;
}

export interface ProfileSettings {
  new_words_per_day: number;
  reviews_per_day: number;
}

export interface Profile {
  display_name: string;
  created_at: string;
  settings: ProfileSettings;
  last_activity: string | null;
}

export interface Unit {
  id: string;
  name: string;
  description: string;
  level: 1 | 2 | 3;
  order_index: number;
  prerequisite_ids: string[];
  grammar_notes: string;
  estimated_hours: number;
}

export interface UnitProgress {
  unit_id: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  mastery_score: number;
}

export interface Session {
  id: string;
  completed_at: string;
  cards_reviewed: number;
  new_words_introduced: number;
  recall_rate: number;
  again_count: number;
  new_words_tomorrow: number;
}

export interface ReviewLog {
  id: string;
  card_id: string;
  session_id: string;
  reviewed_at: string;
  rating: 1 | 2 | 3 | 4 | 5;
  response_ms: number;
  exercise_type: ExerciseType;
  error_type: ErrorType | null;
  prev_stability: number;
  prev_difficulty: number;
  new_stability: number;
  new_difficulty: number;
  scheduled_days: number;
  actual_days: number;
}

export interface SessionReview {
  cardId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  exerciseType: ExerciseType;
  responseMs: number;
  errorType: ErrorType | null;
}

export interface AssembledSession {
  cards: CardWithState[];
  newWordCount: number;
  totalDue: number;
}

export interface FSRSResult {
  new_stability: number;
  new_difficulty: number;
  next_interval_days: number;
  retrievability_at_review: number;
}
