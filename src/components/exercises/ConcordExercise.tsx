import { useState, useRef, useEffect } from 'react';
import type { CardWithState } from '../../types';
import { normalize } from '../../utils/normalize';
import { canSwahiliConcord, parseSwahiliConcord } from '../../languages/swahiliConcord';

interface Props {
  card: CardWithState;
  onAnswer: (correct: boolean, typed: string) => void;
}

export const parseConcord = parseSwahiliConcord;

export function canConcord(card: CardWithState): boolean {
  return canSwahiliConcord(card);
}

export default function ConcordExercise({ card, onAnswer }: Props) {
  const c = parseConcord(card);
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue('');
    setSubmitted(false);
    inputRef.current?.focus();
  }, [card.id]);

  function submit() {
    if (!c || !value.trim() || submitted) return;
    // Accept either the agreeing adjective alone ("mzuri") or the full phrase
    // ("bwana mzuri"); the prompt/placeholder invites the phrase.
    const v = normalize(value);
    const ok = v === normalize(c.answer) || v === normalize(`${c.noun} ${c.answer}`);
    setCorrect(ok);
    setSubmitted(true);
    // Report immediately; LearnScreen owns the feedback delay before rating. (P6.3)
    onAnswer(ok, value);
  }

  if (!c) {
    return (
      <div className="bg-slate-800 rounded-2xl p-6 text-center text-slate-400 text-sm" role="status">
        Preparing next card...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-8 text-center space-y-2">
        <p className="text-slate-400 text-sm">Make the adjective agree with the noun</p>
        <div className="text-3xl font-bold text-slate-100">
          {c.noun} <span className="text-slate-500">+ -{c.stem}</span>
        </div>
        <div className="text-cyan-400 text-sm">"{c.noun}" + "{c.meaning}" -&gt; ?</div>
        {card.noun_class && <div className="text-slate-500 text-xs">{card.noun_class} class</div>}
      </div>

      {submitted && (
        <p aria-live="polite" className={`text-sm font-semibold text-center ${correct ? 'text-green-400' : 'text-red-400'}`}>
          {correct ? 'Correct' : 'Incorrect'}
        </p>
      )}

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        disabled={submitted}
        placeholder={`${c.noun} ...`}
        className={`w-full px-5 py-4 rounded-xl bg-slate-800 border-2 text-slate-100 text-lg placeholder-slate-500 transition-colors ${
          submitted
            ? correct ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'
            : 'border-slate-700 focus:border-cyan-400'
        }`}
      />

      {submitted && !correct && (
        <div className="bg-slate-800 rounded-xl p-3 text-center space-y-1">
          <div>
            <span className="text-slate-400 text-sm">Answer: </span>
            <span className="text-green-400 font-semibold">{c.noun} {c.answer}</span>
          </div>
          <p className="text-slate-500 text-xs">"{card.english}"</p>
        </div>
      )}

      {!submitted && (
        <button
          onClick={submit}
          disabled={!value.trim()}
          className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl transition-colors"
        >
          Check
        </button>
      )}
    </div>
  );
}
