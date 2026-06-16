import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { processReview, learningIntervalMinutes } from '../algorithms/fsrs';
import {
  upsertCardState, insertReviewLog, insertSession,
  recordActivity, updateSkillMastery, updateErrorPattern,
  setCardStarred, flushDatabase, getCurrentLanguage,
} from '../database/db';
import { drawWeightedCard, type SessionModifiers } from '../scheduling/sessionAssembly';
import { classifyError } from '../algorithms/errorClassifier';
import type { CardWithState, ExerciseType, Profile, CardState, DepthLevel, SessionReview } from '../types';

// ─── C-02: Response-time FSRS modifier ───────────────────────────────────────

const RT_CAP_DEFAULT_MS  = 15_000; // 15s ceiling for tap exercises
const RT_CAP_TYPE_MS     = 30_000; // 30s ceiling for type_answer (slow typists)
const RT_TYPING_MS_CHAR  = 200;    // estimated ms per character on mobile keyboard
const RT_FAST_THRESHOLD  = 2_000;  // adjusted recall time considered "fast"
const RT_SLOW_THRESHOLD  = 7_000;  // adjusted recall time considered "slow"
const RT_MIN_REVIEWS     = 3;      // don't apply until card has this many reviews
const RT_MULTIPLIER_MAX  = 1.15;   // fast answers: extend interval by up to 15%
const RT_MULTIPLIER_MIN  = 0.85;   // slow answers: shorten interval by up to 15%
const RT_ROLLING_WEIGHT  = 0.2;    // weight of new reading in rolling average

// Returns the capped, typing-adjusted recall time in ms, or null to skip (fill_blank).
// keypressCount (if provided) is the total keystrokes including backspace corrections,
// which gives a better motor-overhead estimate than raw answer length.
function adjustedRecallMs(
  responseMs: number,
  exerciseType: ExerciseType,
  card: CardWithState,
  keypressCount?: number,
  typingSpeedMsPerChar: number = RT_TYPING_MS_CHAR,
): number | null {
  if (exerciseType === 'fill_blank') return null; // answer length too variable
  const cap    = exerciseType === 'type_answer' ? RT_CAP_TYPE_MS : RT_CAP_DEFAULT_MS;
  const capped = Math.min(responseMs, cap);
  if (exerciseType === 'type_answer') {
    const charCount = (keypressCount && keypressCount > 0)
      ? keypressCount
      : Math.max(card.swahili.length, card.english.length);
    return Math.max(0, capped - charCount * typingSpeedMsPerChar);
  }
  return capped;
}

interface SessionState {
  sessionId: string;
  isActive: boolean;
  startedAt: number;
  pool: CardWithState[];         // all cards available for this session
  current: CardWithState | null; // card being shown
  lastCardId: string | null;     // excluded from next draw to avoid immediate repeat
  reviews: SessionReview[];
  againCount: number;
  newWordsIntroduced: number;
  newWordRate: number;           // 0–100: % chance of drawing a new word
  modifiers: SessionModifiers | null; // ITS / goal weights, loaded once per session
  typingSpeedMsPerChar: number;  // learned per-user typing speed, updated from depth≥4 answers

  startSession: (pool: CardWithState[], newWordRate?: number, modifiers?: SessionModifiers) => void;
  toggleStar: (cardId: string) => Promise<void>;
  submitRating: (
    card: CardWithState,
    rating: 1 | 2 | 3 | 4 | 5,
    exerciseType: ExerciseType,
    responseMs: number,
    wrongAnswer?: string,
    keypressCount?: number,
  ) => Promise<void>;
  markCardKnown: (card: CardWithState, responseMs: number) => Promise<void>;
  finishSession: (profile: Profile) => Promise<void>;
  resetSession: () => void;

  recallRate: () => number;
}

function computeNewDepthLevel(
  card: CardWithState,
  rating: 1 | 2 | 3 | 4 | 5,
  newIntervalDays: number,
): DepthLevel {
  const s = card.state;

  if (s.depth_level === 2.5) {
    if (rating >= 4 && s.review_count > 0) {
      const daysSince = s.last_review ? (Date.now() - new Date(s.last_review).getTime()) / 86400000 : 0;
      if (daysSince >= 14) return 4.5;
    }
    return 2.5;
  }

  if (s.depth_level === 1 || s.depth_level === 2) {
    if (rating >= 3) {
      if (newIntervalDays >= 21) return 4;
      if (newIntervalDays >= 7) return 3;
      return 2;
    }
    return 2;
  }

  if (newIntervalDays >= 365) return 5.3;
  if (newIntervalDays >= 180) return 5.2;
  if (newIntervalDays >= 90)  return 5.1;
  if (newIntervalDays >= 21)  return 4;
  if (newIntervalDays >= 7)   return 3;
  return 2;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: uuidv4(),
  isActive: false,
  startedAt: Date.now(),
  pool: [],
  current: null,
  lastCardId: null,
  reviews: [],
  againCount: 0,
  newWordsIntroduced: 0,
  newWordRate: 0,
  modifiers: null,
  typingSpeedMsPerChar: RT_TYPING_MS_CHAR,

  startSession: (pool, newWordRate = 0, modifiers) => {
    const first = drawWeightedCard(pool, Date.now(), undefined, newWordRate, modifiers);
    set({
      sessionId: uuidv4(),
      isActive: true,
      startedAt: Date.now(),
      pool,
      current: first,
      lastCardId: null,
      reviews: [],
      againCount: 0,
      newWordsIntroduced: 0,
      newWordRate,
      modifiers: modifiers ?? null,
    });
  },

  toggleStar: async (cardId) => {
    const { pool, current } = get();
    const target = pool.find(c => c.id === cardId);
    if (!target) return;
    const newStarred = !target.state.starred;
    await setCardStarred(cardId, newStarred);
    const updatedPool = pool.map(c =>
      c.id === cardId ? { ...c, state: { ...c.state, starred: newStarred } } : c,
    );
    const updatedCurrent =
      current?.id === cardId ? { ...current, state: { ...current.state, starred: newStarred } } : current;
    set({ pool: updatedPool, current: updatedCurrent });
  },

  submitRating: async (card, rating, exerciseType, responseMs, wrongAnswer, keypressCount) => {
    const { sessionId, pool, newWordRate, modifiers, typingSpeedMsPerChar } = get();
    const now = new Date().toISOString();
    const isNewCard = card.state.depth_level === 1 || card.state.review_count === 0;
    const daysSinceLast = card.state.last_review
      ? (Date.now() - new Date(card.state.last_review).getTime()) / 86400000
      : 0;

    const fsrsRating = Math.min(4, rating) as 1 | 2 | 3 | 4;
    const fsrsResult = processReview({
      currentStability: card.state.stability,
      currentDifficulty: card.state.difficulty,
      daysSinceLastReview: daysSinceLast,
      rating: fsrsRating,
      isNewCard,
    });

    const newDepth = computeNewDepthLevel(card, rating, fsrsResult.next_interval_days);

    let nextReviewIso: string;
    if (newDepth <= 2) {
      const mins = learningIntervalMinutes(fsrsRating);
      nextReviewIso = new Date(Date.now() + mins * 60000).toISOString();
    } else {
      nextReviewIso = new Date(Date.now() + fsrsResult.next_interval_days * 86400000).toISOString();
    }

    const newConsecutiveCorrect = rating >= 3 ? card.state.consecutive_correct + 1 : 0;
    let newFastLearnLevel = card.state.fast_learn_level;
    let newFastLearnFailCount = card.state.fast_learn_fail_count;

    if (card.quick_learn && card.state.depth_level === 2) {
      if (rating >= 3) {
        if (newConsecutiveCorrect >= 4) newFastLearnLevel = 2;
      }
    }
    if (card.state.depth_level === 2.5 && rating <= 2) {
      newFastLearnFailCount++;
    }

    // ─── C-02: Response-time multiplier ─────────────────────────────────────────
    const adjusted = adjustedRecallMs(responseMs, exerciseType, card, keypressCount, typingSpeedMsPerChar);
    const prevAvg = card.state.response_time_avg_ms ?? null;

    // Learn per-user typing speed from well-known cards (depth ≥ 4, correct, type_answer).
    // At that depth recall is near-instant, so responseMs ≈ keypresses × speed_per_char.
    if (
      exerciseType === 'type_answer' &&
      rating >= 3 &&
      newDepth >= 4 &&
      keypressCount && keypressCount > 0 &&
      responseMs < RT_CAP_TYPE_MS
    ) {
      const measuredSpeed = responseMs / keypressCount;
      if (measuredSpeed >= 50 && measuredSpeed <= 600) {
        const updatedSpeed = typingSpeedMsPerChar * (1 - RT_ROLLING_WEIGHT) + measuredSpeed * RT_ROLLING_WEIGHT;
        set({ typingSpeedMsPerChar: updatedSpeed });
      }
    }

    // Only update recall-time rolling average on correct answers at depth ≥ 3 with enough reviews.
    let newResponseTimeAvg = prevAvg;
    let rtMultiplier = 1.0;
    if (
      adjusted !== null &&
      rating >= 3 &&
      newDepth >= 3 &&
      card.state.review_count >= RT_MIN_REVIEWS
    ) {
      newResponseTimeAvg = prevAvg === null
        ? adjusted
        : prevAvg * (1 - RT_ROLLING_WEIGHT) + adjusted * RT_ROLLING_WEIGHT;

      if (newResponseTimeAvg < RT_FAST_THRESHOLD) {
        rtMultiplier = RT_MULTIPLIER_MAX;
      } else if (newResponseTimeAvg > RT_SLOW_THRESHOLD) {
        rtMultiplier = RT_MULTIPLIER_MIN;
      }

      // Re-apply multiplier to the interval (learning-phase cards use minute intervals, skip).
      nextReviewIso = new Date(
        Date.now() + fsrsResult.next_interval_days * rtMultiplier * 86400000,
      ).toISOString();
    }

    const updatedState: CardState = {
      ...card.state,
      depth_level: newDepth,
      stability: fsrsResult.new_stability,
      difficulty: fsrsResult.new_difficulty,
      retrievability: fsrsResult.retrievability_at_review,
      last_review: now,
      next_review: nextReviewIso,
      review_count: card.state.review_count + 1,
      lapse_count: rating <= 2 ? card.state.lapse_count + 1 : card.state.lapse_count,
      consecutive_correct: newConsecutiveCorrect,
      fast_learn_level: newFastLearnLevel as 0 | 2 | 4,
      fast_learn_fail_count: newFastLearnFailCount,
      response_time_avg_ms: newResponseTimeAvg,
    };

    const errorType = (rating <= 2 && wrongAnswer)
      ? classifyError(card, wrongAnswer, getCurrentLanguage())
      : null;

    await upsertCardState(updatedState);
    await updateSkillMastery(card.tags, rating >= 3);
    if (errorType) await updateErrorPattern(card.tags, errorType);
    await insertReviewLog({
      id: uuidv4(),
      card_id: card.id,
      session_id: sessionId,
      reviewed_at: now,
      rating,
      response_ms: responseMs,
      exercise_type: exerciseType,
      error_type: errorType,
      prev_stability: card.state.stability,
      prev_difficulty: card.state.difficulty,
      new_stability: fsrsResult.new_stability,
      new_difficulty: fsrsResult.new_difficulty,
      scheduled_days: card.state.next_review
        ? (new Date(card.state.next_review).getTime() - new Date(card.state.last_review ?? now).getTime()) / 86400000
        : 0,
      actual_days: daysSinceLast,
    });

    // Update this card's state in pool so future weight calculations use fresh data
    const updatedPool = pool.map(c =>
      c.id === card.id ? { ...c, state: updatedState } : c,
    );

    // Draw the next card (excluding the one just rated)
    const nowMs = Date.now();
    const next = drawWeightedCard(updatedPool, nowMs, card.id, newWordRate, modifiers ?? undefined, card.type);

    set(prev => ({
      pool: updatedPool,
      current: next,
      lastCardId: card.id,
      reviews: [...prev.reviews, { cardId: card.id, rating, exerciseType, responseMs, errorType }],
      againCount: rating === 1 ? prev.againCount + 1 : prev.againCount,
      newWordsIntroduced: isNewCard && rating >= 3 ? prev.newWordsIntroduced + 1 : prev.newWordsIntroduced,
    }));
  },

  markCardKnown: async (card, responseMs) => {
    const { sessionId, pool, newWordRate, modifiers } = get();
    const now = new Date().toISOString();
    const nextReview = new Date(Date.now() + 10 * 86400000).toISOString();

    const updatedState: CardState = {
      ...card.state,
      depth_level: 3,
      stability: 10,
      difficulty: 0.3,
      retrievability: 1.0,
      last_review: now,
      next_review: nextReview,
      review_count: 1,
      lapse_count: 0,
      consecutive_correct: 3,
      fast_learn_level: 0,
      fast_learn_fail_count: 0,
    };

    await upsertCardState(updatedState);
    await updateSkillMastery(card.tags, true);
    await insertReviewLog({
      id: uuidv4(),
      card_id: card.id,
      session_id: sessionId,
      reviewed_at: now,
      rating: 4,
      response_ms: responseMs,
      exercise_type: 'flashcard',
      error_type: null,
      prev_stability: card.state.stability,
      prev_difficulty: card.state.difficulty,
      new_stability: 10,
      new_difficulty: 0.3,
      scheduled_days: 10,
      actual_days: 0,
    });

    const updatedPool = pool.map(c => c.id === card.id ? { ...c, state: updatedState } : c);
    const next = drawWeightedCard(updatedPool, Date.now(), card.id, newWordRate, modifiers ?? undefined);

    set(prev => ({
      pool: updatedPool,
      current: next,
      lastCardId: card.id,
      reviews: [...prev.reviews, { cardId: card.id, rating: 4, exerciseType: 'flashcard', responseMs, errorType: null }],
      newWordsIntroduced: prev.newWordsIntroduced + 1,
    }));
  },

  finishSession: async (_profile) => {
    const { reviews, againCount, newWordsIntroduced, sessionId } = get();
    const total = reviews.length;
    const recallRate = total > 0 ? reviews.filter(r => r.rating >= 3).length / total : 0;

    await insertSession({
      id: sessionId,
      completed_at: new Date().toISOString(),
      cards_reviewed: total,
      new_words_introduced: newWordsIntroduced,
      recall_rate: recallRate,
      again_count: againCount,
      new_words_tomorrow: 0,
    });
    await recordActivity();
    await flushDatabase();
    set({ isActive: false });
  },

  resetSession: () => set({
    sessionId: uuidv4(),
    isActive: false,
    pool: [],
    current: null,
    lastCardId: null,
    reviews: [],
    againCount: 0,
    newWordsIntroduced: 0,
    modifiers: null,
  }),

  recallRate: () => {
    const { reviews } = get();
    if (!reviews.length) return 0;
    return reviews.filter(r => r.rating >= 3).length / reviews.length;
  },
}));
