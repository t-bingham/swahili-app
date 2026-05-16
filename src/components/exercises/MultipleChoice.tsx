import { useState, useEffect } from 'react';
import type { CardWithState } from '../../types';

interface Props {
  card: CardWithState;
  allCards: CardWithState[];
  onAnswer: (correct: boolean, chosen: string) => void;
  easy?: boolean; // level 4: 2 options, obviously-different distractor
}

export default function MultipleChoice({ card, allCards, onAnswer, easy = false }: Props) {
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
    const cardTagSet = new Set(card.tags);

    const distractors = easy
      // Easy: one distractor from a clearly different semantic group
      ? shuffle(allCards.filter(c => c.id !== card.id && !c.tags.some(t => cardTagSet.has(t))))
          .slice(0, 1)
          .map(c => c.english)
      // Hard: three distractors from the same card type
      : shuffle(allCards.filter(c => c.id !== card.id && c.type === card.type))
          .slice(0, 3)
          .map(c => c.english);

    setOptions(shuffle([card.english, ...distractors]));
    setSelected(null);
  }, [card.id, easy]);

  function choose(opt: string) {
    if (selected) return;
    setSelected(opt);
    setTimeout(() => onAnswer(opt === card.english, opt), 800);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-8 text-center">
        <div className="text-slate-400 text-sm mb-2">What does this mean?</div>
        <div className="text-4xl font-bold text-slate-100">{card.swahili}</div>
        {card.pronunciation && (
          <div className="text-slate-500 text-sm italic mt-1">[{card.pronunciation}]</div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {options.map(opt => {
          const isCorrect = opt === card.english;
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
    </div>
  );
}
