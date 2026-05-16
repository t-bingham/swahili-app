import { useState, useRef, useEffect } from 'react';
import type { CardWithState } from '../../types';

interface Props {
  card: CardWithState;
  onAnswer: (correct: boolean, typed: string) => void;
}

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

// Strip parenthetical context notes: "hello (to one person)" → "hello"
function stripParens(s: string) {
  return s.replace(/\s*\([^)]*\)/g, '').trim();
}

function isAnswerCorrect(typed: string, english: string): boolean {
  const input = normalize(typed);
  const alternatives = english.split(/\s*\/\s*|\s*,\s*/);
  return alternatives.some(alt => normalize(alt) === input || normalize(stripParens(alt)) === input);
}

export default function TypeAnswer({ card, onAnswer }: Props) {
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
    if (!value.trim() || submitted) return;
    const isCorrect = isAnswerCorrect(value, card.english);
    setCorrect(isCorrect);
    setSubmitted(true);
    setTimeout(() => onAnswer(isCorrect, value), 1000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-8 text-center">
        <div className="text-slate-400 text-sm mb-2">Type the English translation</div>
        <div className="text-4xl font-bold text-slate-100">{card.swahili}</div>
        {card.pronunciation && (
          <div className="text-slate-500 text-sm italic mt-1">[{card.pronunciation}]</div>
        )}
      </div>

      <div className="space-y-3">
        {card.english.includes('/') && !submitted && (
          <p className="text-slate-500 text-xs text-center">Any one translation accepted</p>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          disabled={submitted}
          placeholder="Type your answer…"
          className={`w-full px-5 py-4 rounded-xl bg-slate-800 border-2 text-slate-100 text-lg placeholder-slate-500 transition-colors ${
            submitted
              ? correct
                ? 'border-green-500 bg-green-500/10'
                : 'border-red-500 bg-red-500/10'
              : 'border-slate-700 focus:border-cyan-400'
          }`}
        />

        {submitted && !correct && (
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <span className="text-slate-400 text-sm">Correct answer: </span>
            <span className="text-green-400 font-semibold">{card.english}</span>
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
    </div>
  );
}
