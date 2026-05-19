import { useState, useRef, useEffect } from 'react';
import type { CardWithState } from '../../types';
import { MorphemeBreakdown, RegisterBadge } from './MorphemeBreakdown';
import { normalize } from '../../utils/normalize';

interface Props {
  card: CardWithState;
  onAnswer: (correct: boolean, typed: string, keystrokeCount: number) => void;
  direction?: 'sw_to_en' | 'en_to_sw';
  showPronunciation?: boolean;
  showMorphemeHints?: boolean;
}

// Strip parenthetical context notes: "hello (to one person)" → "hello"
function stripParens(s: string) {
  return s.replace(/\s*\([^)]*\)/g, '').trim();
}

function isAnswerCorrect(typed: string, card: CardWithState, direction: 'sw_to_en' | 'en_to_sw'): boolean {
  const input = normalize(typed);
  if (direction === 'en_to_sw') {
    return normalize(card.swahili) === input;
  }
  // sw_to_en: accept any slash/comma-separated alternative, senses, or parenthetical strips
  const targets = card.senses?.map(s => s.english) ?? [];
  targets.push(card.english);
  return targets.some(t => {
    const alternatives = t.split(/\s*\/\s*|\s*,\s*/);
    return alternatives.some(alt => normalize(alt) === input || normalize(stripParens(alt)) === input);
  });
}

export default function TypeAnswer({ card, onAnswer, direction = 'sw_to_en', showPronunciation = true, showMorphemeHints = false }: Props) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const keystrokeCount = useRef(0);

  useEffect(() => {
    setValue('');
    setSubmitted(false);
    keystrokeCount.current = 0;
    inputRef.current?.focus();
  }, [card.id, direction]);

  function submit() {
    if (!value.trim() || submitted) return;
    const isCorrect = isAnswerCorrect(value, card, direction);
    setCorrect(isCorrect);
    setSubmitted(true);
    setTimeout(() => onAnswer(isCorrect, value, keystrokeCount.current), 1000);
  }

  const prompt    = direction === 'sw_to_en' ? card.swahili : card.english;
  const answer    = direction === 'sw_to_en' ? card.english : card.swahili;
  const promptLabel = direction === 'sw_to_en' ? 'Type the English translation' : 'Type the Swahili translation';
  const hasAlts   = direction === 'sw_to_en' && (card.english.includes('/') || (card.senses?.length ?? 0) > 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-8 text-center">
        <div className="text-slate-400 text-sm mb-2">{promptLabel}</div>
        <div className="text-4xl font-bold text-slate-100">{prompt}</div>
        {direction === 'sw_to_en' && card.pronunciation && showPronunciation && (
          <div className="text-slate-500 text-sm italic mt-1">[{card.pronunciation}]</div>
        )}
      </div>

      <div className="space-y-3">
        {hasAlts && !submitted && (
          <p className="text-slate-500 text-xs text-center">Any one translation accepted</p>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            // Count every keypress (including backspace corrections) as motor overhead
            if (!submitted) {
              // Only skip backspace-clearing the whole word — that's giving up, not correcting
              const isFullClear = e.key === 'Backspace' && (e.target as HTMLInputElement).value.length <= 1;
              if (!isFullClear) keystrokeCount.current++;
            }
            if (e.key === 'Enter') submit();
          }}
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
            <span className="text-green-400 font-semibold">{answer}</span>
            {direction === 'en_to_sw' && card.pronunciation && (
              <div className="text-slate-500 text-sm italic mt-1">[{card.pronunciation}]</div>
            )}
          </div>
        )}

        {submitted && correct && direction === 'en_to_sw' && card.pronunciation && (
          <div className="text-center text-slate-500 text-sm italic">[{card.pronunciation}]</div>
        )}

        {submitted && showMorphemeHints && (
          <div className="bg-slate-800/60 rounded-xl p-3">
            <MorphemeBreakdown card={card} />
          </div>
        )}

        {submitted && card.register && card.register !== 'neutral' && (
          <div className="flex justify-center">
            <RegisterBadge register={card.register} />
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
