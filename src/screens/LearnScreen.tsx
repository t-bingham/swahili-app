import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, getSkillMastery, getDailyStats, getStarredCards } from '../database/db';
import { scaffoldLevel, scaffoldHint } from '../algorithms/afm';
import { buildPracticePool, loadSessionModifiers } from '../scheduling/sessionAssembly';
import { uploadToDrive } from '../sync/driveSync';
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
  settings: ProfileSettings,
): { exercise: UiPhaseExercise; level: 1 | 2 | 3 | 4 | 5 } {
  if (card.type === 'grammar' && card.swahili.includes('___')) {
    return { exercise: 'fill_blank', level: 3 };
  }
  if (card.state.depth_level === 1 || card.state.review_count === 0) {
    return { exercise: 'recall_prompt', level: 5 };
  }
  const level = scaffoldLevel(card, mastery);
  let exercise: UiPhaseExercise =
    level >= 5 ? 'flashcard' :
    level >= 3 ? 'multiple_choice' :
    'type_answer';
  // Apply disable preferences — fall back up the scaffold ladder
  if (exercise === 'type_answer' && settings.disable_type_answer) {
    exercise = 'multiple_choice';
  }
  if (exercise === 'flashcard' && settings.disable_flashcard) {
    exercise = 'multiple_choice';
  }
  return { exercise, level };
}

// Resolve a single exercise direction from the user's preference setting.
function resolveDirection(setting?: ProfileSettings['exercise_direction']): 'sw_to_en' | 'en_to_sw' {
  if (setting === 'recognition') return 'sw_to_en';
  if (setting === 'production')  return 'en_to_sw';
  // balanced: 50/50
  return Math.random() < 0.5 ? 'sw_to_en' : 'en_to_sw';
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
  const [mode, setMode] = useState<'review' | 'learn' | 'starred'>('review');
  const [activeMode, setActiveMode] = useState<'review' | 'learn' | 'starred'>('review');
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
  const settingsRef = useRef<ProfileSettings>({ new_words_per_day: 10, reviews_per_day: 20, new_word_rate: 20 });
  const goalsNotified = useRef(new Set<'reviews' | 'new_words'>());
  const sessionStartStats = useRef({ reviewsToday: 0, newWordsToday: 0 });

  const card = store.current;

  // When the current card changes, set up the exercise
  useEffect(() => {
    if (!store.isActive || !card) return;
    const { exercise: ex, level: lv } = pickExercise(card, skillMastery, settingsRef.current);
    setExercise(ex);
    setLevel(lv);
    // direction applies to all exercise types (not just flashcard)
    setDirection(resolveDirection(settingsRef.current.exercise_direction));
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

    setActiveMode(mode);
    const [rawPool, modifiers] = await Promise.all([
      mode === 'starred' ? getStarredCards() : buildPracticePool(mode, profile?.settings),
      loadSessionModifiers(profile?.settings.learning_goal),
    ]);
    setAssembling(false);

    if (!rawPool.length) {
      setPhase('empty');
      return;
    }

    const newWordRate = mode === 'learn' ? (profile?.settings.new_word_rate ?? 20) : 0;
    store.startSession(rawPool, newWordRate, modifiers);
  }

  // ── Session end ──────────────────────────────────────────────────────────────

  async function endSession() {
    const profile = await getProfile();
    if (profile) {
      await store.finishSession(profile);
    }
    uploadToDrive(); // fire-and-forget; fails silently if offline or not signed in
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

  async function onRecallAlreadyKnow() {
    if (!card) return;
    await store.markCardKnown(card, Date.now() - startMs.current);
    startMs.current = Date.now();
    // Phase/exercise will update via the useEffect on card?.id
  }

  // ── Exercise answer handler ──────────────────────────────────────────────────

  const keystrokeCountRef = useRef<number | undefined>(undefined);

  function onExerciseAnswer(correct: boolean, typed?: string, keystrokeCount?: number) {
    keystrokeCountRef.current = keystrokeCount;
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
    await store.submitRating(card, rating, ex, responseMs, wrongAnswer ?? undefined, keystrokeCountRef.current);
    keystrokeCountRef.current = undefined;
    try { await checkGoals(); } catch { /* never block on goal-check error */ }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <div className="p-5 space-y-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-slate-100 pt-2">Practice</h1>

        {/* Mode selector */}
        <div className="space-y-3">
          <button
            onClick={() => setMode('review')}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${
              mode === 'review'
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔁</span>
              <div>
                <p className="text-slate-100 font-semibold">Review</p>
                <p className="text-slate-400 text-sm">Practice words you already know — no new words.</p>
              </div>
              {mode === 'review' && <span className="ml-auto text-cyan-400">✓</span>}
            </div>
          </button>

          <button
            onClick={() => setMode('learn')}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${
              mode === 'learn'
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌱</span>
              <div>
                <p className="text-slate-100 font-semibold">Learn</p>
                <p className="text-slate-400 text-sm">Mix reviews with new words as you go.</p>
              </div>
              {mode === 'learn' && <span className="ml-auto text-cyan-400">✓</span>}
            </div>
          </button>

          <button
            onClick={() => setMode('starred')}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${
              mode === 'starred'
                ? 'border-yellow-500 bg-yellow-500/10'
                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="text-slate-100 font-semibold">Starred Words</p>
                <p className="text-slate-400 text-sm">Practice only the words you've starred.</p>
              </div>
              {mode === 'starred' && <span className="ml-auto text-yellow-400">✓</span>}
            </div>
          </button>
        </div>

        <button
          onClick={startSession}
          disabled={assembling}
          className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-lg rounded-2xl transition-colors"
        >
          {assembling ? 'Loading…' : 'Start →'}
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
    const isStarredEmpty = activeMode === 'starred';
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-6xl">{isStarredEmpty ? '⭐' : '📚'}</div>
          <h2 className="text-2xl font-bold text-slate-100">
            {isStarredEmpty ? 'Nothing starred yet' : 'Nothing to practice yet'}
          </h2>
          <p className="text-slate-400">
            {isStarredEmpty
              ? 'Star words during practice or in the Card Gallery to build your starred list.'
              : 'Complete a lesson in the Units tab to get started.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setPhase('idle')}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-xl"
            >
              Back
            </button>
            {!isStarredEmpty && (
              <button
                onClick={() => navigate('/app/units')}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl"
              >
                Go to Units
              </button>
            )}
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => store.toggleStar(card.id)}
            className={`text-xl leading-none transition-colors ${
              card.state.starred ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'
            }`}
            aria-label={card.state.starred ? 'Unstar this word' : 'Star this word'}
          >
            {card.state.starred ? '★' : '☆'}
          </button>
          <button
            onClick={endSession}
            className="text-slate-600 hover:text-slate-300 transition-colors"
          >
            End session
          </button>
        </div>
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
          <RecallPrompt card={card} onKnew={onRecallKnew} onDidntKnow={onRecallDidntKnow} onAlreadyKnow={onRecallAlreadyKnow} />
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
                showPronunciation={settingsRef.current.pronunciation_style !== 'none'}
                showExamples={settingsRef.current.show_example_sentences !== false}
                showMorphemeHints={!!(settingsRef.current.show_morpheme_hints || settingsRef.current.grammar_depth === 'linguist')}
              />
            )}
            {exercise === 'multiple_choice' && (
              <MultipleChoice
                card={card}
                allCards={store.pool}
                onAnswer={onExerciseAnswer}
                easy={level >= 4}
                direction={direction}
                showMorphemeHints={!!(settingsRef.current.show_morpheme_hints || settingsRef.current.grammar_depth === 'linguist')}
              />
            )}
            {exercise === 'type_answer' && (
              <TypeAnswer
                card={card}
                onAnswer={onExerciseAnswer}
                direction={direction}
                showPronunciation={settingsRef.current.pronunciation_style !== 'none'}
                showMorphemeHints={!!(settingsRef.current.show_morpheme_hints || settingsRef.current.grammar_depth === 'linguist')}
              />
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
