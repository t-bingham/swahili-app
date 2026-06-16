import { useState, useRef, useEffect } from 'react';
import type { CardWithState } from '../../types';
import type { LanguageAdapter } from '../../languages';
import { normalize } from '../../utils/normalize';

interface Props {
  card: CardWithState;
  language: LanguageAdapter;
  onAnswer: (correct: boolean, typed: string) => void;
}

export default function FillInBlank({ card, language, onAnswer }: Props) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const blankIndex = card.swahili.indexOf('___');
  const before = blankIndex >= 0 ? card.swahili.slice(0, blankIndex) : card.swahili;
  const after = blankIndex >= 0 ? card.swahili.slice(blankIndex + 3) : '';
  const full = language.getTargetExample(card) ?? '';
  const targetExample = language.getTargetExample(card);
  const englishExample = language.getEnglishExample(card);
  const grammarHint = language.grammarHint(card);

  const correctAnswer =
    blankIndex >= 0 && full.startsWith(before) && full.endsWith(after) && full.length > before.length + after.length
      ? full.slice(before.length, full.length - after.length).trim()
      : (card.verb_root ?? '');

  useEffect(() => {
    setValue('');
    setSubmitted(false);
    inputRef.current?.focus();
  }, [card.id]);

  function submit() {
    if (!value.trim() || submitted) return;
    const isCorrect = !!correctAnswer && normalize(value) === normalize(correctAnswer);
    setCorrect(isCorrect);
    setSubmitted(true);
    onAnswer(isCorrect, value);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-6">
        <div className="text-slate-400 text-sm mb-4">Fill in the blank</div>
        <div className="text-xl text-slate-100 leading-relaxed">
          {before}
          <span className={`inline-block border-b-2 min-w-16 text-center mx-1 px-2 ${submitted ? (correct ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400') : 'border-cyan-400 text-cyan-400'}`}>
            {submitted ? value || '-' : value || ' '}
          </span>
          {after}
        </div>
        <div className="mt-4 text-slate-500 text-sm italic">"{language.getEnglishText(card)}"</div>
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
        placeholder="Fill in..."
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
          {grammarHint && (
            <p className="text-cyan-300/80 text-xs text-center">Tip: {grammarHint}</p>
          )}
          {targetExample && englishExample && (
            <div className="border-t border-slate-700 pt-2">
              <p className="text-slate-500 text-xs mb-1">Remember it with:</p>
              <p className="text-slate-300 text-sm italic">"{targetExample}"</p>
              <p className="text-slate-500 text-xs">"{englishExample}"</p>
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
