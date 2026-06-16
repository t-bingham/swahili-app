import type { CardWithState, ErrorType, ExerciseType } from '../types';
import type { LanguageConfig } from '../data/languages';

export type StudyDirection = 'target_to_en' | 'en_to_target';
export type SpecialExerciseType = Extract<ExerciseType, 'noun_class' | 'concord' | 'particle_choice' | 'maori_tense'>;

export interface SpecialExerciseCandidate {
  exercise: SpecialExerciseType;
  level: 1 | 2 | 3 | 4 | 5;
  probability?: number;
}

export interface LanguageAdapter {
  config: LanguageConfig;
  id: string;
  targetName: string;
  targetShortName: string;
  locale: string;
  ttsLangPrefixes: string[];
  getTargetText(card: CardWithState): string;
  getEnglishText(card: CardWithState): string;
  getTargetExample(card: CardWithState): string | undefined;
  getEnglishExample(card: CardWithState): string | undefined;
  grammarHint(card: CardWithState): string | null;
  scaffoldHint(card: CardWithState): string | undefined;
  classifyError(card: CardWithState, given: string): ErrorType | null;
  specialExercises(card: CardWithState, baseExercise: ExerciseType, level: 1 | 2 | 3 | 4 | 5): SpecialExerciseCandidate[];
  directionLabel(direction: StudyDirection): string;
  promptLabel(direction: StudyDirection, kind: 'multiple_choice' | 'type_answer' | 'flashcard'): string;
  searchPlaceholder(): string;
  searchAriaLabel(): string;
  csvFilenamePrefix(): string;
  audioUnavailableHint(): string;
}
