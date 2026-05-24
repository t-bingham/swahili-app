import { useState, useEffect } from 'react';
import type { CardWithState } from '../../types';
import { MorphemeBreakdown, RegisterBadge } from './MorphemeBreakdown';

interface Props {
  card: CardWithState;
  allCards: CardWithState[];
  onAnswer: (correct: boolean, chosen: string) => void;
  easy?: boolean; // level 4: 2 options, obviously-different distractor
  direction?: 'sw_to_en' | 'en_to_sw';
  showMorphemeHints?: boolean;
}

export default function MultipleChoice({ card, allCards, onAnswer, easy = false, direction = 'sw_to_en', showMorphemeHints = false }: Props) {
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const correctAnswer = direction === 'sw_to_en' ? card.english : card.swahili;

  useEffect(() => {
    const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
    const cardTagSet = new Set(card.tags);
    const extract = (c: CardWithState) => direction === 'sw_to_en' ? c.english : c.swahili;

    const distractors = easy
      ? shuffle(allCards.filter(c => c.id !== card.id && !c.tags.some(t => cardTagSet.has(t))))
          .slice(0, 1)
          .map(extract)
      : shuffle(allCards.filter(c => c.id !== card.id && c.type === card.type))
          .slice(0, 3)
          .map(extract);

    setOptions(shuffle([correctAnswer, ...distractors]));
    setSelected(null);
  }, [card.id, easy, direction]);

  function choose(opt: string) {
    if (selected) return;
    setSelected(opt);
    setTimeout(() => onAnswer(opt === correctAnswer, opt), 800);
  }

  const prompt      = direction === 'sw_to_en' ? card.swahili : card.english;
  const promptLabel = direction === 'sw_to_en' ? 'What does this mean?' : 'How do you say this in Swahili?';

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-8 text-center">
        <div className="text-slate-400 text-sm mb-2">{promptLabel}</div>
        <div className="text-4xl font-bold text-slate-100">{prompt}</div>
        {direction === 'sw_to_en' && card.pronunciation && (
          <div className="text-slate-500 text-sm italic mt-1">[{card.pronunciation}]</div>
        )}
      </div>

      {selected && direction === 'en_to_sw' && card.pronunciation && (
        <div className="text-center text-slate-500 text-sm italic">[{card.pronunciation}]</div>
      )}

      {selected && showMorphemeHints && (
        <div className="bg-slate-800/60 rounded-xl p-3">
          <MorphemeBreakdown card={card} />
        </div>
      )}

      {selected && card.register && card.register !== 'neutral' && (
        <div className="flex justify-center">
          <RegisterBadge register={card.register} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {options.map(opt => {
          const isCorrect = opt === correctAnswer;
          const isSelected = selected === opt;
          let cls = 'w-full py-4 px-5 rounded-xl text-left font-medium transition-all border-2 ';
          if (!selected) {
            cls += 'border-slate-700 bg-slate-800 text-slate-200 hover:border-cyan-400 hover:bg-slate-700';
          } else if (isSelected && isCorrect) {
            cls += 'border-green-500 bg-green-500/20 text-green-400';
          } else if (isSelected && !isCorrect) {
            cls += 'border-red-500 bg-red-500/20 text-red-400';
          } else if (isCorrect) {
            cls += 'border-green-500 bg-green-500/10 text-green-400';
          } else {
            cls += 'border-slate-700 bg-slate-800 text-slate-400 opacity-50';
          }
          return (
            <button key={opt} className={cls} onClick={() => choose(opt)}>
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <p aria-live="polite" className={`text-sm font-semibold text-center ${selected === correctAnswer ? 'text-green-400' : 'text-red-400'}`}>
          {selected === correctAnswer ? '✓ Correct' : '✗ Incorrect'}
        </p>
      )}


      {selected !== null && selected !== correctAnswer && card.example_sentences[0] && (
        <div className="bg-slate-800/60 rounded-xl p-3 space-y-1">
          <p className="text-slate-500 text-xs">Remember it with:</p>
          <p className="text-slate-300 text-sm italic">"{card.example_sentences[0].swahili}"</p>
          <p className="text-slate-500 text-xs">"{card.example_sentences[0].english}"</p>
        </div>
      )}
    </div>
  );
}
