import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlacementCards, applyPlacementResult, getUnitAtOrAfter } from '../database/db';
import { validatePlacementAnswer, pickDistractors, scorePlacement, PLACEMENT_MAX_MISSES } from '../utils/placementTest';
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
  correct: number;
  total: number;
  label: string;
  orderIndex: number;
  targetUnit: Unit | null;
  onStartHere: () => void;
  onStartBeginning: () => void;
}

function ResultScreen({ correct, total, label, orderIndex, targetUnit, onStartHere, onStartBeginning }: ResultProps) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 gap-8 max-w-sm mx-auto">
      <div className="text-center space-y-2">
        <div className="text-6xl font-bold text-cyan-400">{correct}/{total}</div>
        <p className="text-slate-400 text-sm">{pct}% correct before 5 misses</p>
      </div>

      <div className="w-full bg-slate-800 rounded-2xl p-6 text-center space-y-2">
        <p className="text-slate-500 text-xs uppercase tracking-widest">Estimated Level</p>
        <p className="text-2xl font-bold text-slate-100">{label}</p>
        {orderIndex > 0 && targetUnit ? (
          <p className="text-slate-400 text-sm mt-1">
            We suggest starting at <span className="text-cyan-400 font-semibold">{targetUnit.name}</span>
          </p>
        ) : (
          <p className="text-slate-400 text-sm mt-1">Start from the very beginning for the best foundation.</p>
        )}
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

  const [phase, setPhase]       = useState<Phase>('loading');
  const [cards, setCards]       = useState<CardWithState[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [misses, setMisses]     = useState(0);
  const [correct, setCorrect]   = useState(0);

  // Per-question state
  const [options, setOptions]   = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Result state
  const [targetUnit, setTargetUnit] = useState<Unit | null>(null);
  const [result, setResult]         = useState<{ correct: number; total: number; label: string; orderIndex: number } | null>(null);

  useEffect(() => {
    getPlacementCards().then(loaded => {
      setCards(loaded);
      setPhase('testing');
    });
  }, []);

  // Regenerate options whenever cardIndex changes
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
    if (selected !== null) return; // already answered

    const card = cards[cardIndex];
    const correct_ = validatePlacementAnswer(opt, card);

    setSelected(opt);
    setIsCorrect(correct_);

    const newMisses  = misses  + (correct_ ? 0 : 1);
    const newCorrect = correct + (correct_ ? 1 : 0);
    const nextIndex  = cardIndex + 1;

    setTimeout(() => {
      if (newMisses >= PLACEMENT_MAX_MISSES || nextIndex >= cards.length) {
        // Test finished — compute result
        const scored = scorePlacement(newCorrect);
        setResult({ ...scored, correct: newCorrect, total: nextIndex });
        getUnitAtOrAfter(scored.orderIndex).then(unit => {
          setTargetUnit(unit);
          setPhase('result');
        });
      } else {
        setMisses(newMisses);
        setCorrect(newCorrect);
        setCardIndex(nextIndex);
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
        correct={result.correct}
        total={result.total}
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

  const missesLeft = PLACEMENT_MAX_MISSES - misses;

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
        <div className="flex items-center gap-2">
          {Array.from({ length: PLACEMENT_MAX_MISSES }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                i < misses ? 'bg-red-500' : 'bg-slate-700'
              }`}
            />
          ))}
          <span className="text-slate-500 text-xs ml-1">{missesLeft} left</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-800 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-cyan-500 rounded-full transition-all"
          style={{ width: `${(cardIndex / cards.length) * 100}%` }}
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

      <p className="text-center text-slate-700 text-xs mt-6 pb-4">
        {cardIndex + 1} / {cards.length}
      </p>
    </div>
  );
}
