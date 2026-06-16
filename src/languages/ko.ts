import type { LanguageConfig } from '../data/languages';
import type { CardWithState, ErrorType, ExerciseType } from '../types';
import type { LanguageAdapter, SpecialExerciseCandidate } from './types';
import { createBaseAdapter, genericScaffoldHint } from './shared';
import { genericClassifyError, normalizedEditRatio } from './errorUtils';
import { normalize as norm } from '../utils/normalize';

const CONJUGATION_HINTS: Record<string, string> = {
  fp: 'Formal polite present uses the -습니다/-ㅂ니다 style. It is common in presentations, news, service settings, and formal introductions.',
  fpa: 'Formal polite past usually adds -았/었- before -습니다. Look for the past marker inside the ending.',
  fpf: 'Formal polite future commonly uses -겠습니다 for intention or commitment.',
  pp: 'Polite present is the everyday -아요/-어요 style. It is safe with most adults and strangers.',
  ppa: 'Polite past adds -았/었- before 요: 했어요, 갔어요, 먹었어요.',
  pf: 'Polite future often uses -(으)ㄹ 거예요 after the verb stem.',
  cp: 'Casual present usually drops 요 from the polite form. Use it only with close friends, younger people, or family when appropriate.',
  cpa: 'Casual past usually drops 요 from the polite past form.',
  npp: 'The short negative pattern places 안 before the verb phrase: 안 가요, 안 먹어요.',
  nfp: 'Formal negative still keeps the formal ending; the negation comes before the verb phrase.',
  nfpa: 'Formal past negative combines negation with a past formal ending.',
  hp: 'Honorific polite forms use -(으)시- or special honorific verbs to respect the subject of the sentence.',
  hf: 'Formal honorific combines subject honorific marking with formal polite speech level.',
  hpa: 'Honorific past keeps the honorific marker and adds past tense.',
  hfut: 'Honorific future keeps the honorific marker and adds a future expression.',
  nhp: 'Negative honorific keeps the subject-honorific form but negates the verb phrase.',
};

function grammarHint(card: CardWithState): string | null {
  if (card.type === 'conjugation' && card.conjugation_key) {
    return CONJUGATION_HINTS[formSuffix(card.conjugation_key)] ?? null;
  }

  const target = card.swahili;
  if (target.includes('은') || target.includes('는')) {
    return '은/는 marks the topic: what the sentence is about, contrast, or old/shared information.';
  }
  if (target.includes('이') || target.includes('가')) {
    return '이/가 marks the subject, often new information or the thing doing/being something.';
  }
  if (target.includes('을') || target.includes('를')) {
    return '을/를 marks the object: the thing directly affected by the action.';
  }
  if (target.includes('요')) {
    return '요 makes the sentence polite. Dropping it usually makes the sentence casual.';
  }
  if (target.includes('(으)세요')) {
    return '(으)세요 is a polite request/command ending and can also carry honorific respect for the subject.';
  }
  if (target.includes('고 싶어요')) {
    return '고 싶어요 attaches to a verb stem to mean "want to do".';
  }
  if (target.includes('(으)면')) {
    return '(으)면 means "if/when"; use 으면 after consonant stems and 면 after vowel stems.';
  }
  if (target.includes('(으)려고')) {
    return '(으)려고 means "in order to" or "intending to"; it points toward purpose.';
  }
  if (card.part_of_speech === 'particle') {
    return 'Korean particles attach to the noun before them and show the noun role in the sentence.';
  }
  return null;
}

function scaffoldHint(card: CardWithState): string | undefined {
  if (card.type === 'conjugation' && card.conjugation_key) {
    return CONJUGATION_HINTS[formSuffix(card.conjugation_key)]?.split('.')[0] ?? genericScaffoldHint(card);
  }
  if (card.part_of_speech === 'particle') return 'particle';
  return genericScaffoldHint(card);
}

const FORM_FAMILIES: Record<string, string> = {
  fp: 'formal',
  fpa: 'formal',
  fpf: 'formal',
  pp: 'polite',
  ppa: 'polite',
  pf: 'polite',
  cp: 'casual',
  cpa: 'casual',
  npp: 'negative',
  nfp: 'negative',
  nfpa: 'negative',
  hp: 'honorific',
  hf: 'honorific',
  hpa: 'honorific',
  hfut: 'honorific',
  nhp: 'honorific-negative',
};

function formSuffix(conjugationKey: string): string {
  if (!conjugationKey.startsWith('ko:')) return conjugationKey;
  const parts = conjugationKey.split(':');
  return parts[parts.length - 1] || conjugationKey;
}

function expectedMarkers(key: string): string[] {
  key = formSuffix(key);
  const markers: string[] = [];
  if (key.startsWith('f')) markers.push('습니다', 'ㅂ니다', '겠습니다');
  if (['pp', 'ppa', 'pf', 'hp', 'hpa', 'hfut', 'npp', 'nhp'].includes(key)) markers.push('요');
  if (key.includes('pa') || key === 'hpa' || key === 'fpa') markers.push('었', '았', '했');
  if (key === 'pf' || key === 'hfut' || key === 'fpf') markers.push('거예요', '겠습니다');
  if (FORM_FAMILIES[key]?.includes('honorific')) markers.push('시', '세', '께', '드');
  if (FORM_FAMILIES[key]?.includes('negative')) markers.push('안', '않');
  return markers;
}

function hasAny(text: string, markers: string[]): boolean {
  return markers.some(marker => text.includes(marker));
}

function classifyError(card: CardWithState, given: string): ErrorType | null {
  if (card.type === 'conjugation' && card.conjugation_key) {
    const expected = expectedMarkers(card.conjugation_key);
    const correct = card.swahili;
    const wrong = given.trim();

    if (normalizedEditRatio(correct, wrong) <= 0.25) return 'phonological';

    const correctBase = norm(correct).replace(/(습니다|ㅂ니다|어요|아요|요|다)$/u, '');
    const wrongBase = norm(wrong).replace(/(습니다|ㅂ니다|어요|아요|요|다)$/u, '');
    const sameOrSimilarStem = correctBase.length >= 2 && wrongBase.length >= 2 &&
      (correctBase.includes(wrongBase.slice(0, 2)) || wrongBase.includes(correctBase.slice(0, 2)));

    if (sameOrSimilarStem && expected.length > 0 && !hasAny(wrong, expected)) return 'structural';
    if (sameOrSimilarStem) return 'structural';
  }

  if (card.part_of_speech === 'particle' || card.type === 'grammar') {
    const grammarTokens = card.swahili.split(/\s*\/\s*|\s+/).filter(Boolean);
    if (grammarTokens.length > 0 && grammarTokens.some(token => given.includes(token))) {
      return 'structural';
    }
  }

  return genericClassifyError(card, given);
}

function specialExercises(
  card: CardWithState,
  baseExercise: ExerciseType,
  level: 1 | 2 | 3 | 4 | 5,
): SpecialExerciseCandidate[] {
  if (
    baseExercise === 'multiple_choice' &&
    level >= 3 &&
    card.type === 'grammar' &&
    card.part_of_speech === 'particle'
  ) {
    return [{ exercise: 'particle_choice', level: 3 }];
  }
  return [];
}

export function createKoreanAdapter(config: LanguageConfig): LanguageAdapter {
  return {
    ...createBaseAdapter(config),
    grammarHint,
    scaffoldHint,
    classifyError,
    specialExercises,
  };
}
