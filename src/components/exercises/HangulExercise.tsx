import { useState } from 'react';
import type { Jamo } from '../../data/hangul';

interface Props {
  jamo: Jamo;
  options: string[];                 // romanizations incl. the correct one
  onAnswer: (correct: boolean) => void;
}

// One Hangul recognition question: show the letter, pick its sound. Reports the answer
// immediately; the parent screen owns the brief feedback delay before advancing.
export default function HangulExercise({ jamo, options, onAnswer }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  function choose(opt: string) {
    if (selected) return;
    setSelected(opt);
    onAnswer(opt === jamo.rom);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-8 text-center">
        <div className="text-slate-400 text-sm mb-3">What sound does this letter make?</div>
        <div className="text-7xl font-bold text-slate-100" lang="ko">{jamo.char}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map(opt => {
          const isCorrect = opt === jamo.rom;
          const isSel = selected === opt;
          let cls = 'py-4 px-5 rounded-xl text-lg font-semibold border-2 transition-all ';
          if (!selected) cls += 'border-slate-700 bg-slate-800 text-slate-200 hover:border-pink-400 hover:bg-slate-700';
          else if (isSel && isCorrect) cls += 'border-green-500 bg-green-500/20 text-green-400';
          else if (isSel && !isCorrect) cls += 'border-red-500 bg-red-500/20 text-red-400';
          else if (isCorrect) cls += 'border-green-500 bg-green-500/10 text-green-400';
          else cls += 'border-slate-700 bg-slate-800 text-slate-400 opacity-50';
          return (
            <button key={opt} className={cls} onClick={() => choose(opt)} disabled={!!selected}>
              {opt}
            </button>
          );
        })}
      </div>

      {selected && (
        <p aria-live="polite" className={`text-sm font-semibold text-center ${selected === jamo.rom ? 'text-green-400' : 'text-red-400'}`}>
          {selected === jamo.rom ? '✓ Correct' : `✗ It's “${jamo.rom}”`}
        </p>
      )}

      {selected && (
        <div className="bg-slate-800/60 rounded-xl p-3 text-center space-y-1">
          <p className="text-slate-300 text-sm">{jamo.sound}</p>
          <p className="text-slate-500 text-xs">e.g. <span lang="ko">{jamo.example}</span></p>
        </div>
      )}
    </div>
  );
}
