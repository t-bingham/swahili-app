import { useState, useRef, useEffect } from 'react';
import type { CardWithState } from '../../types';
import { normalize } from '../../utils/normalize';

interface Props {
  card: CardWithState;
  onAnswer: (correct: boolean, typed: string) => void;
}

export default function FillInBlank({ card, onAnswer }: Props) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive the blank answer from the swahili field (the card already has ___ in it)
  // The english field is the full sentence translation
  const blankIndex = card.swahili.indexOf('___');
  const before = blankIndex >= 0 ? card.swahili.slice(0, blankIndex) : card.swahili;
  const after = blankIndex >= 0 ? card.swahili.slice(blankIndex + 3) : '';

  // The correct answer is the verb_root or extracted from example_sentences
  const correctAnswer = card.example_sentences[0]
    ? card.example_sentences[0].swahili.replace(before, '').replace(after, '').trim()
    : card.verb_root ?? '';

  useEffect(() => {
    setValue('');
    setSubmitted(false);
    inputRef.current?.focus();
  }, [card.id]);

  function submit() {
    if (!value.trim() || submitted) return;
    const isCorrect = normalize(value) === normalize(correctAnswer);
    setCorrect(isCorrect);
    setSubmitted(true);
    setTimeout(() => onAnswer(isCorrect, value), 1000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-6">
        <div className="text-slate-400 text-sm mb-4">Fill in the blank</div>
        <div className="text-xl text-slate-100 leading-relaxed">
          {before}
          <span className={`inline-block border-b-2 min-w-16 text-center mx-1 px-2 ${submitted ? (correct ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400') : 'border-cyan-400 text-cyan-400'}`}>
            {submitted ? value || '–' : value || ' '}
          </span>
          {after}
        </div>
        <div className="mt-4 text-slate-500 text-sm italic">"{card.english}"</div>
      </div>

      {submitted && (
        <p aria-live="polite" className={`text-sm font-semibold text-center ${correct ? 'text-green-400' : 'text-red-400'}`}>
          {correct ? '✓ Correct' : '✗ Incorrect'}
        </p>
      )}

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        disabled={submitted}
        placeholder="Fill in…"
        className={`w-full px-5 py-4 rounded-xl bg-slate-800 border-2 text-slate-100 text-lg placeholder-slate-500 transition-colors ${
          submitted
            ? correct ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'
            : 'border-slate-700 focus:border-cyan-400'
        }`}
      />

      {submitted && !correct && (
        <div className="bg-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-slate-400 text-sm">Answer: </span>
            <span className="text-green-400 font-semibold">{correctAnswer}</span>
          </div>
          {card.example_sentences[0] && (
            <div className="border-t border-slate-700 pt-2">
              <p className="text-slate-500 text-xs mb-1">Remember it with:</p>
              <p className="text-slate-300 text-sm italic">"{card.example_sentences[0].swahili}"</p>
              <p className="text-slate-500 text-xs">"{card.example_sentences[0].english}"</p>
            </div>
          )}
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
