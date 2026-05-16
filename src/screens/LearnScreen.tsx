import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, getSkillMastery, getDailyStats } from '../database/db';
import { scaffoldLevel, scaffoldHint } from '../algorithms/afm';
import { buildPracticePool } from '../scheduling/sessionAssembly';
import { useSessionStore } from '../store/sessionStore';
import FlashCard from '../components/exercises/FlashCard';
import MultipleChoice from '../components/exercises/MultipleChoice';
import TypeAnswer from '../components/exercises/TypeAnswer';
import FillInBlank from '../components/exercises/FillInBlank';
import RecallPrompt from '../components/exercises/RecallPrompt';
import RatingButtons from '../components/RatingButtons';
import SessionInsights from '../components/SessionInsights';
import type { CardWithState, ExerciseType, ProfileSettings } from '../types';

// ─── Exercise picker ──────────────────────────────────────────────────────────

type UiPhaseExercise = ExerciseType | 'recall_prompt';

function pickExercise(
  card: CardWithState,
  mastery: Map<string, number>,
): { exercise: UiPhaseExercise; level: 1 | 2 | 3 | 4 | 5 } {
  if (card.type === 'grammar' && card.swahili.includes('___')) {
    return { exercise: 'fill_blank', level: 3 };
  }
  if (card.state.depth_level === 1 || card.state.review_count === 0) {
    return { exercise: 'recall_prompt', level: 5 };
  }
  const level = scaffoldLevel(card, mastery);
  const exercise: UiPhaseExercise =
    level >= 5 ? 'flashcard' :
    level >= 3 ? 'multiple_choice' :
    'type_answer';
  return { exercise, level };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type Phase =
  | 'idle'
  | 'loading'
  | 'empty'
  | 'recall_prompt'
  | 'recall_reveal'
  | 'exercise'
  | 'rating'
  | 'summary';

export default function LearnScreen() {
  const navigate = useNavigate();
  const store = useSessionStore();

  const [phase, setPhase] = useState<Phase>('idle');
  const [assembling, setAssembling] = useState(false);
  const [exercise, setExercise] = useState<UiPhaseExercise>('flashcard');
  const [level, setLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [direction, setDirection] = useState<'sw_to_en' | 'en_to_sw'>('sw_to_en');
  const [skillMastery, setSkillMastery] = useState<Map<string, number>>(new Map());
  const [revealed, setRevealed] = useState(false);
  const [autoCorrect, setAutoCorrect] = useState<boolean | null>(null);
  const [wrongAnswer, setWrongAnswer] = useState<string | null>(null);
  const [recallKnew, setRecallKnew] = useState(false);
  const [goalPopup, setGoalPopup] = useState<'reviews' | 'new_words' | null>(null);
  const startMs = useRef(Date.now());
  const settingsRef = useRef<ProfileSettings>({ new_words_per_day: 10, reviews_per_day: 20 });
  const goalsNotified = useRef(new Set<'reviews' | 'new_words'>());
  const sessionStartStats = useRef({ reviewsToday: 0, newWordsToday: 0 });

  const card = store.current;

  // When the current card changes, set up the exercise
  useEffect(() => {
    if (!store.isActive || !card) return;
    const { exercise: ex, level: lv } = pickExercise(card, skillMastery);
    setExercise(ex);
    setLevel(lv);
    setDirection(ex === 'flashcard' ? (Math.random() < 0.5 ? 'sw_to_en' : 'en_to_sw') : 'sw_to_en');
    setRevealed(false);
    setAutoCorrect(null);
    setWrongAnswer(null);
    setRecallKnew(false);
    setPhase(ex === 'recall_prompt' ? 'recall_prompt' : 'exercise');
    startMs.current = Date.now();
  }, [card?.id, store.isActive]);

  // ── Session start ────────────────────────────────────────────────────────────

  async function startSession() {
    setAssembling(true);
    goalsNotified.current = new Set();
    const [mastery, profile, startStats] = await Promise.all([
      getSkillMastery(), getProfile(), getDailyStats(),
    ]);
    setSkillMastery(mastery);
    if (profile) settingsRef.current = profile.settings;
    sessionStartStats.current = startStats;

    const pool = await buildPracticePool();
    setAssembling(false);

    if (!pool.length) {
      setPhase('empty');
      return;
    }

    store.startSession(pool);
  }

  // ── Session end ──────────────────────────────────────────────────────────────

  async function endSession() {
    const profile = await getProfile();
    if (profile) {
      await store.finishSession(profile);
    }
    setPhase('summary');
  }

  // ── Recall prompt handlers ───────────────────────────────────────────────────

  function onRecallKnew() {
    setRecallKnew(true);
    setRevealed(true);
    setPhase('recall_reveal');
  }

  function onRecallDidntKnow() {
    setRecallKnew(false);
    setRevealed(true);
    setPhase('recall_reveal');
  }

  // ── Exercise answer handler ──────────────────────────────────────────────────

  function onExerciseAnswer(correct: boolean, typed?: string) {
    setAutoCorrect(correct);
    setWrongAnswer(correct ? null : (typed ?? null));
    setPhase('rating');
  }

  // ── Goal check ───────────────────────────────────────────────────────────────

  async function checkGoals() {
    const { reviews_per_day, new_words_per_day } = settingsRef.current;
    const stats = await getDailyStats();
    const newWordsToday = stats.newWordsToday + store.newWordsIntroduced;

    const reviewsCrossed =
      !goalsNotified.current.has('reviews') &&
      stats.reviewsToday >= reviews_per_day &&
      sessionStartStats.current.reviewsToday < reviews_per_day;

    const newWordsCrossed =
      !goalsNotified.current.has('new_words') &&
      newWordsToday >= new_words_per_day &&
      sessionStartStats.current.newWordsToday < new_words_per_day;

    if (reviewsCrossed) {
      goalsNotified.current.add('reviews');
      setGoalPopup('reviews');
    } else if (newWordsCrossed) {
      goalsNotified.current.add('new_words');
      setGoalPopup('new_words');
    }
  }

  // ── Rating submission ─────────────────────────────────────────────────────────

  async function submitRating(rating: 1 | 2 | 3 | 4 | 5) {
    if (!card) return;
    const responseMs = Date.now() - startMs.current;
    const ex: ExerciseType = exercise === 'recall_prompt' ? 'flashcard' : exercise as ExerciseType;
    await store.submitRating(card, rating, ex, responseMs, wrongAnswer ?? undefined);
    try { await checkGoals(); } catch { /* never block on goal-check error */ }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <div className="p-5 space-y-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-slate-100 pt-2">Practice</h1>
        <p className="text-slate-400 text-sm">
          Cards are drawn based on how soon they're due and how recently you learned them.
          Practice as long as you like and end whenever you're ready.
        </p>
        <button
          onClick={startSession}
          disabled={assembling}
          className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-lg rounded-2xl transition-colors"
        >
          {assembling ? 'Loading…' : 'Start practicing →'}
        </button>
      </div>
    );
  }

  if (phase === 'loading' || assembling) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-slate-400">
          <div className="text-4xl mb-3 animate-spin">⏳</div>
          Loading…
        </div>
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-6xl">📚</div>
          <h2 className="text-2xl font-bold text-slate-100">Nothing to practice yet</h2>
          <p className="text-slate-400">Complete a lesson in the Units tab to get started.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setPhase('idle')}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-xl"
            >
              Back
            </button>
            <button
              onClick={() => navigate('/app/units')}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl"
            >
              Go to Units
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'summary') {
    return (
      <SessionInsights
        reviews={store.reviews}
        queue={store.pool}
        recall={store.recallRate()}
        onStudyAgain={() => { store.resetSession(); setPhase('idle'); }}
        onDone={() => navigate('/app/home')}
      />
    );
  }

  if (!card) return null;

  const reviewedCount = store.reviews.length;
  const isNewCard = card.state.depth_level === 1 || card.state.review_count === 0;

  if (goalPopup) {
    const isReviews = goalPopup === 'reviews';
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 max-w-lg mx-auto text-center">
        <div className="text-6xl mb-4">{isReviews ? '🔥' : '🌱'}</div>
        <h2 className="text-2xl font-bold text-slate-100 mb-2">
          {isReviews ? 'Review goal reached!' : 'New word goal reached!'}
        </h2>
        <p className="text-slate-400 text-sm mb-8">
          {isReviews
            ? `You've hit your daily review target of ${settingsRef.current.reviews_per_day} reviews. Great consistency!`
            : `You've introduced ${settingsRef.current.new_words_per_day} new words today. Your vocabulary is growing!`}
        </p>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => setGoalPopup(null)}
            className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-lg rounded-2xl transition-colors"
          >
            Keep going!
          </button>
          <button
            onClick={endSession}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors"
          >
            End session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
        <span>{reviewedCount} reviewed this session</span>
        <button
          onClick={endSession}
          className="text-slate-600 hover:text-slate-300 transition-colors"
        >
          End session
        </button>
      </div>

      {/* Exercise area */}
      <div className="flex-1 overflow-y-auto space-y-4">

        {/* New word badge */}
        {isNewCard && (
          <div className="flex justify-center">
            <span className="px-3 py-1 bg-cyan-500/15 border border-cyan-500/30 rounded-full text-cyan-400 text-xs font-semibold tracking-wide">
              NEW WORD
            </span>
          </div>
        )}

        {/* ── Recall prompt (first exposure) ── */}
        {phase === 'recall_prompt' && (
          <RecallPrompt card={card} onKnew={onRecallKnew} onDidntKnow={onRecallDidntKnow} />
        )}

        {/* ── Recall reveal ── */}
        {phase === 'recall_reveal' && (
          <>
            <div className="bg-slate-800 rounded-2xl p-8 text-center space-y-3">
              <div className="text-4xl font-bold text-slate-100">{card.swahili}</div>
              {card.pronunciation && (
                <div className="text-slate-500 text-sm italic">[{card.pronunciation}]</div>
              )}
            </div>
            <div className="bg-slate-800/50 rounded-2xl p-6 text-center space-y-2">
              <div className="text-2xl text-cyan-400 font-semibold">{card.english}</div>
              {card.example_sentences[0] && (
                <div className="text-slate-400 text-sm italic">"{card.example_sentences[0].english}"</div>
              )}
            </div>
          </>
        )}

        {/* ── Standard exercises ── */}
        {(phase === 'exercise' || phase === 'rating') && (
          <>
            {exercise === 'flashcard' && (
              <FlashCard
                card={card}
                onReveal={() => setRevealed(true)}
                revealed={revealed}
                hint={level >= 5 ? scaffoldHint(card) : undefined}
                direction={direction}
              />
            )}
            {exercise === 'multiple_choice' && (
              <MultipleChoice card={card} allCards={store.pool} onAnswer={onExerciseAnswer} easy={level >= 4} />
            )}
            {exercise === 'type_answer' && (
              <TypeAnswer card={card} onAnswer={onExerciseAnswer} />
            )}
            {exercise === 'fill_blank' && (
              <FillInBlank card={card} onAnswer={onExerciseAnswer} />
            )}
          </>
        )}
      </div>

      {/* Rating buttons */}
      <div className="mt-4 shrink-0">
        {phase === 'recall_reveal' && recallKnew && (
          <RatingButtons onRate={submitRating} />
        )}
        {phase === 'recall_reveal' && !recallKnew && (
          <RatingButtons onRate={submitRating} showDidntKnow />
        )}
        {phase === 'exercise' && exercise === 'flashcard' && revealed && (
          <RatingButtons onRate={submitRating} />
        )}
        {phase === 'rating' && (
          <RatingButtons onRate={submitRating} showSimplified={autoCorrect === false} />
        )}
      </div>
    </div>
  );
}
