export type CardType = 'vocabulary' | 'phrase' | 'grammar' | 'conjugation';
export type ExerciseType =
  | 'flashcard'
  | 'multiple_choice'
  | 'type_answer'
  | 'fill_blank'
  | 'noun_class'
  | 'sentence_cloze'
  | 'concord'
  | 'particle_choice'
  | 'maori_tense';
export type ErrorType = 'phonological' | 'semantic' | 'structural';
export type SessionType = 1 | 2 | 3 | 4;
export type DepthLevel = 1 | 2 | 2.5 | 3 | 4 | 4.5 | 5.1 | 5.2 | 5.3;

// ─── Learner customisation types ─────────────────────────────────────────────

export type LearningGoal =
  | 'travel_survival'
  | 'live_in_country'        // moving to Tanzania, Kenya, or another Swahili region
  | 'family_community'
  | 'business_professional'
  | 'academic_literary'
  | 'cultural_curiosity';

export type GrammarDepth = 'communication' | 'fluency' | 'linguist';
export type ExerciseDirection = 'recognition' | 'production' | 'balanced';
export type PronunciationStyle = 'syllable' | 'ipa' | 'none';

// ─── Card metadata types ──────────────────────────────────────────────────────

export type CardRegister = 'formal' | 'neutral' | 'informal' | 'slang' | 'literary' | 'mixed';
export type CardDialect  = 'standard' | 'coastal' | 'nairobi' | 'congolese';
export type Etymology    = 'bantu' | 'arabic' | 'english' | 'portuguese' | 'hindi' | 'french';
export type PartOfSpeech =
  | 'noun' | 'verb' | 'adjective' | 'adverb'
  | 'conjunction' | 'interjection' | 'phrase' | 'particle';

export interface CardSense {
  english:  string;
  pos?:     PartOfSpeech;
  register?: CardRegister;
  note?:    string;
}

// One slot in the compositional morpheme breakdown of a conjugated form
export interface MorphemeSlot {
  morpheme: string;  // e.g. 'na'
  slot:     string;  // e.g. 'tense_marker'
  gloss:    string;  // e.g. 'PRES'
}

// ─── Card ─────────────────────────────────────────────────────────────────────

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
  source: 'handwritten' | 'generated' | 'reviewed';
  prerequisite_card_id?: string;
  example_sentences: Array<{ swahili: string; english: string }>;
  register?:            CardRegister;
  morpheme_breakdown?:  MorphemeSlot[];
  part_of_speech?:      PartOfSpeech;
  etymology?:           Etymology;
  dialect?:             CardDialect;
  cultural_note?:       string;
  senses?:              CardSense[];
  placement_only?:      boolean;
}

// ─── Card State ───────────────────────────────────────────────────────────────

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
  response_time_avg_ms?: number | null;
  starred?: boolean;
}

export interface CardWithState extends Card {
  state: CardState;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface ProfileSettings {
  // Existing
  new_words_per_day: number;
  reviews_per_day:   number;
  new_word_rate:     number; // 0–100: % chance of drawing a new word in Learn mode
  learning_goal?:       LearningGoal;
  grammar_depth?:       GrammarDepth;
  exercise_direction?:  ExerciseDirection;
  preferred_register?:  CardRegister;
  // Exercise preferences
  disable_type_answer?:    boolean;
  disable_flashcard?:      boolean;
  show_morpheme_hints?:         boolean;
  show_example_sentences?:      boolean;
  show_pronunciation_on_reveal?: boolean;
  enable_audio?:           boolean; // browser TTS 🔊 button on reveal (only if a Swahili voice exists)
  pronunciation_style?:    PronunciationStyle;
  // Display / accessibility
  large_text?:             boolean;
  high_contrast?:          boolean;
  gamification_enabled?:   boolean;
  dialect_preference?:     CardDialect;
}

export interface Profile {
  display_name: string;
  created_at: string;
  settings: ProfileSettings;
  last_activity: string | null;
}

// ─── Units ────────────────────────────────────────────────────────────────────

export interface Unit {
  id: string;
  name: string;
  description: string;
  level: 1 | 2 | 3;
  order_index: number;
  prerequisite_ids: string[];
  grammar_notes: string;
  estimated_hours: number;
  track?: 'vocabulary' | 'grammar';
}

export interface UnitProgress {
  unit_id: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  mastery_score: number;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

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

// ─── Morpheme mastery (A-03) ──────────────────────────────────────────────────

export interface MorphemeMastery {
  morpheme:     string;
  slot:         string;
  opportunities: number;
  correct:      number;
  updated_at:   string;
}
