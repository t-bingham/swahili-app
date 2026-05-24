import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlacementCards, applyPlacementResult, getUnitAtOrAfter } from '../database/db';
import { validatePlacementAnswer, pickDistractors, scorePlacementByPosition, PLACEMENT_MAX_QUESTIONS } from '../utils/placementTest';
import type { CardWithState, Unit } from '../types';

// ─── Loading state ────────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <p className="text-slate-400">Loading placement test…</p>
    </div>
  );
}

// ─── Result screen ────────────────────────────────────────────────────────────

interface ResultProps {
  questions:   number;
  label:       string;
  orderIndex:  number;
  targetUnit:  Unit | null;
  onStartHere:      () => void;
  onStartBeginning: () => void;
}

function ResultScreen({ questions, label, orderIndex, targetUnit, onStartHere, onStartBeginning }: ResultProps) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 gap-8 max-w-sm mx-auto">
      <div className="w-full bg-slate-800 rounded-2xl p-6 text-center space-y-2">
        <p className="text-slate-500 text-xs uppercase tracking-widest">Estimated Level</p>
        <p className="text-3xl font-bold text-slate-100">{label}</p>
        {orderIndex > 0 && targetUnit ? (
          <p className="text-slate-400 text-sm mt-1">
            We suggest starting at{' '}
            <span className="text-cyan-400 font-semibold">{targetUnit.name}</span>
          </p>
        ) : (
          <p className="text-slate-400 text-sm mt-1">
            Start from the very beginning for the best foundation.
          </p>
        )}
        <p className="text-slate-600 text-xs pt-1">
          Calibrated in {questions} question{questions !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="w-full space-y-3">
        {orderIndex > 0 && targetUnit && (
          <button
            onClick={onStartHere}
            className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-2xl text-lg transition-colors"
          >
            Start at {targetUnit.name} →
          </button>
        )}
        <button
          onClick={onStartBeginning}
          className={`w-full py-4 font-bold rounded-2xl transition-colors ${
            orderIndex > 0 && targetUnit
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 text-base'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-lg'
          }`}
        >
          Start from the Beginning
        </button>
      </div>

      <p className="text-slate-600 text-xs text-center">
        You can re-take the placement test anytime in Settings.
      </p>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type Phase = 'loading' | 'testing' | 'result';

export default function PlacementTestScreen() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [cards, setCards] = useState<CardWithState[]>([]);

  // Binary-search state.
  // Invariant: lo <= cardIndex < hi.
  // On correct answer: lo = cardIndex + 1 (learner cleared this card → search upper half).
  // On wrong answer:   hi = cardIndex     (learner failed here  → search lower half).
  // Converges when lo >= hi or after PLACEMENT_MAX_QUESTIONS questions.
  // Final placement is derived from `lo` (highest difficulty the learner cleared).
  const [lo, setLo]             = useState(0);
  const [hi, setHi]             = useState(0); // initialised to cards.length in useEffect
  const [cardIndex, setCardIndex] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);

  // Per-question UI state
  const [options, setOptions]   = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Result state
  const [targetUnit, setTargetUnit] = useState<Unit | null>(null);
  const [result, setResult]         = useState<{ label: string; orderIndex: number; questions: number } | null>(null);

  useEffect(() => {
    getPlacementCards().then(loaded => {
      setCards(loaded);
      // Start in the middle of the pool so the first question is already informative.
      const mid = Math.floor(loaded.length / 2);
      setHi(loaded.length);
      setCardIndex(mid);
      setPhase('testing');
    });
  }, []);

  // Regenerate options whenever the card changes.
  useEffect(() => {
    if (phase !== 'testing' || !cards.length) return;
    const card = cards[cardIndex];
    const distractors = pickDistractors(card, cards);
    const all = [card.english, ...distractors].sort(() => Math.random() - 0.5);
    setOptions(all);
    setSelected(null);
    setIsCorrect(null);
  }, [cardIndex, phase, cards]);

  function handleSelect(opt: string) {
    if (selected !== null) return;

    const card = cards[cardIndex];
    const wasCorrect = validatePlacementAnswer(opt, card);
    setSelected(opt);
    setIsCorrect(wasCorrect);

    const newCount = questionCount + 1;
    const newLo = wasCorrect ? cardIndex + 1 : lo;
    const newHi = wasCorrect ? hi : cardIndex;

    setTimeout(() => {
      if (newLo >= newHi || newCount >= PLACEMENT_MAX_QUESTIONS) {
        // Search converged — score from the highest difficulty cleared (newLo).
        const scored = scorePlacementByPosition(newLo, cards.length);
        setResult({ ...scored, questions: newCount });
        getUnitAtOrAfter(scored.orderIndex).then(unit => {
          setTargetUnit(unit);
          setPhase('result');
        });
      } else {
        setLo(newLo);
        setHi(newHi);
        setCardIndex(Math.floor((newLo + newHi) / 2));
        setQuestionCount(newCount);
      }
    }, 900);
  }

  async function handleStartHere() {
    if (result) await applyPlacementResult(result.orderIndex);
    navigate('/app/home');
  }

  function handleStartBeginning() {
    navigate('/app/home');
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (phase === 'loading') return <LoadingView />;

  // ── Result ───────────────────────────────────────────────────────────────────

  if (phase === 'result' && result) {
    return (
      <ResultScreen
        questions={result.questions}
        label={result.label}
        orderIndex={result.orderIndex}
        targetUnit={targetUnit}
        onStartHere={handleStartHere}
        onStartBeginning={handleStartBeginning}
      />
    );
  }

  // ── Question ─────────────────────────────────────────────────────────────────

  const card = cards[cardIndex];
  if (!card) return <LoadingView />;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-6 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-2">
        <button
          onClick={() => navigate('/app/home')}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          ✕ Quit
        </button>
        <span className="text-slate-500 text-xs">
          Question {questionCount + 1} / ~{PLACEMENT_MAX_QUESTIONS}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-800 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-cyan-500 rounded-full transition-all"
          style={{ width: `${(questionCount / PLACEMENT_MAX_QUESTIONS) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col justify-center gap-6">
        <div className="bg-slate-800 rounded-2xl p-8 text-center">
          <p className="text-slate-500 text-sm mb-3">What does this mean?</p>
          <p className="text-4xl font-bold text-slate-100 mb-2">{card.swahili}</p>
          {card.pronunciation && (
            <p className="text-slate-500 text-sm italic">[{card.pronunciation}]</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          {options.map(opt => {
            const isThis   = selected === opt;
            const correct_ = selected !== null && validatePlacementAnswer(opt, card);
            let cls = 'w-full py-4 px-5 rounded-xl text-left font-medium transition-all border-2 ';
            if (selected === null) {
              cls += 'border-slate-700 bg-slate-800 text-slate-200 hover:border-cyan-400 hover:bg-slate-700';
            } else if (isThis && correct_) {
              cls += 'border-green-500 bg-green-500/20 text-green-400';
            } else if (isThis && !correct_) {
              cls += 'border-red-500 bg-red-500/20 text-red-400';
            } else if (correct_) {
              cls += 'border-green-500 bg-green-500/10 text-green-400';
            } else {
              cls += 'border-slate-700 bg-slate-800 text-slate-400 opacity-40';
            }
            return (
              <button key={opt} className={cls} onClick={() => handleSelect(opt)}>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-center text-slate-700 text-xs mt-6 pb-4">Calibrating your level…</p>
    </div>
  );
}
