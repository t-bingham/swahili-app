import type { CardWithState } from '../types';
import type { LanguageConfig } from '../data/languages';
import type { LanguageAdapter, StudyDirection } from './types';
import { genericClassifyError } from './errorUtils';

function articleFor(name: string): string {
  return name.toLowerCase().startsWith('te reo') ? name : name;
}

export function genericScaffoldHint(card: CardWithState): string | undefined {
  if (card.noun_class) return `${card.noun_class} noun`;
  if (card.verb_root) return `base: ${card.verb_root}`;
  if (card.type === 'conjugation' && card.conjugation_key) {
    return card.conjugation_key.replace(/[-_:]/g, ' ');
  }
  const contentTag = card.tags.find(t => !['conjugation', 'infinitive', 'production', 'plural', 'fill-blank'].includes(t));
  return contentTag;
}

export function createBaseAdapter(config: LanguageConfig): LanguageAdapter {
  const targetName = config.targetLanguageName;
  const targetShortName = config.targetLanguageShortName;

  return {
    config,
    id: config.id,
    targetName,
    targetShortName,
    locale: config.locale,
    ttsLangPrefixes: config.ttsLangPrefixes,
    getTargetText: (card: CardWithState) => card.swahili,
    getEnglishText: (card: CardWithState) => card.english,
    getTargetExample: (card: CardWithState) => card.example_sentences[0]?.swahili,
    getEnglishExample: (card: CardWithState) => card.example_sentences[0]?.english,
    grammarHint: () => null,
    scaffoldHint: genericScaffoldHint,
    classifyError: genericClassifyError,
    specialExercises: () => [],
    directionLabel(direction: StudyDirection) {
      return direction === 'target_to_en'
        ? `${targetShortName} -> English`
        : `English -> ${targetShortName}`;
    },
    promptLabel(direction: StudyDirection, kind: 'multiple_choice' | 'type_answer' | 'flashcard') {
      if (direction === 'target_to_en') {
        return kind === 'type_answer' ? 'Type the English translation' : 'What does this mean?';
      }
      if (kind === 'flashcard') return `Translate to ${articleFor(targetName)}`;
      if (kind === 'type_answer') return `Type the ${targetShortName} translation`;
      return `How do you say this in ${articleFor(targetName)}?`;
    },
    searchPlaceholder() {
      return `Search ${targetShortName} or English...`;
    },
    searchAriaLabel() {
      return `Search cards by ${targetShortName} or English`;
    },
    csvFilenamePrefix() {
      return `${config.id}_cards`;
    },
    audioUnavailableHint() {
      return `Only works if your device has a ${targetShortName} voice installed; otherwise the button stays hidden.`;
    },
  };
}
