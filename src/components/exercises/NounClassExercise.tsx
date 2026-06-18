import { useState } from 'react';
import type { CardWithState } from '../../types';
import { ALL_NOUN_CLASSES, NOUN_CLASS_INFO, type NounClass } from '../../data/nounClasses';

interface Props {
  card: CardWithState; // card.noun_class must be set
  onAnswer: (correct: boolean, chosen: string) => void;
}

export function canNounClassExercise(card: CardWithState): card is CardWithState & { noun_class: NounClass } {
  return !!card.noun_class && (ALL_NOUN_CLASSES as readonly string[]).includes(card.noun_class);
}

// Build a stable set of 4 options: correct + 3 random distractors
function buildOptions(correct: NounClass): NounClass[] {
  const others = ALL_NOUN_CLASSES.filter(c => c !== correct);
  // shuffle and take 3
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const four = [...others.slice(0, 3), correct];
  // shuffle again so correct isn't always last
  for (let i = four.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [four[i], four[j]] = [four[j], four[i]];
  }
  return four;
}

export default function NounClassExercise({ card, onAnswer }: Props) {
  const correct = canNounClassExercise(card) ? card.noun_class : null;
  const [options] = useState(() => buildOptions(correct ?? ALL_NOUN_CLASSES[0]));
  const [selected, setSelected] = useState<NounClass | null>(null);

  const info = correct ? NOUN_CLASS_INFO[correct] ?? null : null;

  function choose(cls: NounClass) {
    if (selected) return;
    setSelected(cls);
    // Report immediately; LearnScreen owns the feedback delay before rating. (P6.3)
    onAnswer(cls === correct, cls);
  }

  if (!correct) {
    return (
      <div className="bg-slate-800 rounded-2xl p-6 text-center text-slate-400 text-sm" role="status">
        Preparing next card...
      </div>
    );
  }

  function optionStyle(cls: NounClass) {
    const base = 'flex-1 min-w-[calc(50%-6px)] py-4 px-3 rounded-xl border-2 text-center transition-colors ';
    if (!selected) return base + 'border-slate-700 bg-slate-800 hover:border-cyan-400 hover:bg-slate-700 cursor-pointer';
    if (cls === correct)  return base + 'border-green-500 bg-green-500/15 text-green-300';
    if (cls === selected) return base + 'border-red-500 bg-red-500/15 text-red-300';
    return base + 'border-slate-700 bg-slate-800 opacity-40';
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Prompt */}
      <div className="bg-slate-800 rounded-2xl p-8 text-center space-y-2">
        <p className="text-slate-400 text-sm">What noun class does this word belong to?</p>
        <div className="text-4xl font-bold text-slate-100">{card.swahili}</div>
        {card.pronunciation && (
          <div className="text-slate-500 text-sm italic">[{card.pronunciation}]</div>
        )}
        <div className="text-xl text-cyan-400 font-medium pt-1">{card.english}</div>
      </div>

      {/* 2 × 2 option grid */}
      <div className="flex flex-wrap gap-3">
        {options.map(cls => {
          const ci = NOUN_CLASS_INFO[cls];
          if (!ci) return null;
          return (
            <button key={cls} onClick={() => choose(cls)} className={optionStyle(cls)}>
              <div className="font-bold text-slate-100 text-base">{ci.label}</div>
              <div className="text-slate-400 text-xs mt-0.5">{ci.desc}</div>
            </button>
          );
        })}
      </div>

      {selected && (
        <p aria-live="polite" className={`text-sm font-semibold text-center ${selected === correct ? 'text-green-400' : 'text-red-400'}`}>
          {selected === correct ? '✓ Correct' : '✗ Incorrect'}
        </p>
      )}

      {/* Post-answer class detail */}
      {selected && info && (
        <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 space-y-2 text-sm">
          <p className="text-slate-300 font-semibold">{info.label} — {info.desc}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
            <span>Singular prefix</span><span className="text-slate-200 font-mono">{info.sg}</span>
            <span>Plural prefix</span>  <span className="text-slate-200 font-mono">{info.pl}</span>
            <span>Verb (sg / pl)</span> <span className="text-slate-200 font-mono">{info.verbSg} / {info.verbPl}</span>
          </div>
          <p className="text-slate-500 text-xs pt-1">e.g. {info.example}</p>
        </div>
      )}
    </div>
  );
}
