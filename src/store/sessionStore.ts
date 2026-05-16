import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { processReview, learningIntervalMinutes } from '../algorithms/fsrs';
import {
  upsertCardState, insertReviewLog, insertSession,
  recordActivity, updateSkillMastery, updateErrorPattern,
} from '../database/db';
import { drawWeightedCard } from '../scheduling/sessionAssembly';
import { classifyError } from '../algorithms/errorClassifier';
import type { CardWithState, ExerciseType, Profile, CardState, DepthLevel, SessionReview } from '../types';

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

  startSession: (pool: CardWithState[], newWordRate?: number) => void;
  submitRating: (
    card: CardWithState,
    rating: 1 | 2 | 3 | 4 | 5,
    exerciseType: ExerciseType,
    responseMs: number,
    wrongAnswer?: string,
  ) => Promise<void>;
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

  startSession: (pool, newWordRate = 0) => {
    const first = drawWeightedCard(pool, Date.now(), undefined, newWordRate);
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
    });
  },

  submitRating: async (card, rating, exerciseType, responseMs, wrongAnswer) => {
    const { sessionId, pool, newWordRate } = get();
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

    let newConsecutiveCorrect = card.state.consecutive_correct;
    let newFastLearnLevel = card.state.fast_learn_level;
    let newFastLearnFailCount = card.state.fast_learn_fail_count;

    if (card.quick_learn && card.state.depth_level === 2) {
      if (rating >= 3) {
        newConsecutiveCorrect++;
        if (newConsecutiveCorrect >= 4) newFastLearnLevel = 2;
      } else {
        newConsecutiveCorrect = 0;
      }
    }
    if (card.state.depth_level === 2.5 && rating <= 2) {
      newFastLearnFailCount++;
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
      consecutive_correct: rating >= 3 ? newConsecutiveCorrect + 1 : 0,
      fast_learn_level: newFastLearnLevel as 0 | 2 | 4,
      fast_learn_fail_count: newFastLearnFailCount,
    };

    const errorType = (rating <= 2 && wrongAnswer)
      ? classifyError(card.english, wrongAnswer, card.type)
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
    const next = drawWeightedCard(updatedPool, nowMs, card.id, newWordRate);

    set(prev => ({
      pool: updatedPool,
      current: next,
      lastCardId: card.id,
      reviews: [...prev.reviews, { cardId: card.id, rating, exerciseType, responseMs, errorType }],
      againCount: rating === 1 ? prev.againCount + 1 : prev.againCount,
      newWordsIntroduced: isNewCard && rating >= 3 ? prev.newWordsIntroduced + 1 : prev.newWordsIntroduced,
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
  }),

  recallRate: () => {
    const { reviews } = get();
    if (!reviews.length) return 0;
    return reviews.filter(r => r.rating >= 3).length / reviews.length;
  },
}));
