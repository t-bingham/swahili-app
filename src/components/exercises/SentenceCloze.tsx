import { useState, useRef, useEffect } from 'react';
import type { CardWithState } from '../../types';
import { normalize } from '../../utils/normalize';

interface Props {
  card: CardWithState;
  onAnswer: (correct: boolean, typed: string) => void;
}

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Blank the target word inside the card's first example sentence. Returns null
// when the word can't be located (the picker uses canCloze to avoid that).
export function buildCloze(card: CardWithState):
  { before: string; after: string; answer: string; english: string } | null {
  const ex = card.example_sentences?.[0];
  const target = card.swahili?.trim() ?? '';
  if (!ex || card.type !== 'vocabulary' || !target || /\s/.test(target)) return null;
  const m = ex.swahili.match(new RegExp(`\\b${escapeRe(target)}\\b`, 'i'));
  if (!m || m.index === undefined) return null;
  return {
    before: ex.swahili.slice(0, m.index),
    after: ex.swahili.slice(m.index + m[0].length),
    answer: m[0],
    english: ex.english,
  };
}

export function canCloze(card: CardWithState): boolean {
  return buildCloze(card) !== null;
}

export default function SentenceCloze({ card, onAnswer }: Props) {
  const cloze = buildCloze(card)!; // guaranteed by canCloze in the picker
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
    const ok = normalize(value) === normalize(cloze.answer);
    setCorrect(ok);
    setSubmitted(true);
    // Report immediately; LearnScreen owns the feedback delay before rating. (P6.3)
    onAnswer(ok, value);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-6">
        <div className="text-slate-400 text-sm mb-4">Fill in the missing word</div>
        <div className="text-xl text-slate-100 leading-relaxed">
          {cloze.before}
          <span className={`inline-block border-b-2 min-w-16 text-center mx-1 px-2 ${submitted ? (correct ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400') : 'border-cyan-400 text-cyan-400'}`}>
            {submitted ? value || '–' : value || ' '}
          </span>
          {cloze.after}
        </div>
        <div className="mt-4 text-slate-500 text-sm italic">"{cloze.english}"</div>
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
        placeholder="Type the missing word…"
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
            <span className="text-green-400 font-semibold">{cloze.answer}</span>
          </div>
          <p className="text-slate-500 text-xs">{card.swahili} — "{card.english}"</p>
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
