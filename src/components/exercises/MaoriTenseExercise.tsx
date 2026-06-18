import { useState } from 'react';
import type { CardWithState } from '../../types';

interface Props {
  card: CardWithState;
  onAnswer: (correct: boolean, chosen: string) => void;
}

const FRAMES = [
  { key: 'kei-te', label: 'kei te', role: 'happening now' },
  { key: 'e-ana', label: 'e ... ana', role: 'continuous action' },
  { key: 'kua', label: 'kua', role: 'completed / has become' },
  { key: 'i', label: 'i', role: 'past event' },
  { key: 'ka', label: 'ka', role: 'future / inceptive / habitual' },
  { key: 'me', label: 'me', role: 'should / ought to' },
  { key: 'kia', label: 'kia', role: 'should / so that' },
  { key: 'kaore-e', label: 'kaore ... e', role: 'negative frame' },
  { key: 'kaua-e', label: 'kaua ... e', role: 'negative command' },
  { key: 'he', label: 'he', role: 'present state' },
];

function keyBase(conjugationKey?: string): string {
  if (!conjugationKey) return '';
  if (conjugationKey.startsWith('mi:')) return conjugationKey.split(':')[1] ?? '';
  const parts = conjugationKey.split('-');
  if (parts[0] === 'kei' && parts[1] === 'te') return 'kei-te';
  if (parts[0] === 'e' && parts[1] === 'ana') return 'e-ana';
  if (parts[0] === 'kaore' && parts[1] === 'e') return 'kaore-e';
  if (parts[0] === 'kaua' && parts[1] === 'e') return 'kaua-e';
  return parts[0];
}

export function canMaoriTenseExercise(card: CardWithState): boolean {
  return card.type === 'conjugation' &&
    card.tags.includes('tense-pattern') &&
    FRAMES.some(frame => frame.key === keyBase(card.conjugation_key));
}

function buildOptions(correctKey: string) {
  const correct = FRAMES.find(f => f.key === correctKey) ?? FRAMES[0];
  const pool = FRAMES.filter(f => f.key !== correct.key);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const options = [correct, ...pool.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

export default function MaoriTenseExercise({ card, onAnswer }: Props) {
  const correctKey = keyBase(card.conjugation_key);
  const [options] = useState(() => buildOptions(correctKey));
  const [selected, setSelected] = useState<string | null>(null);

  function choose(key: string) {
    if (selected) return;
    setSelected(key);
    onAnswer(key === correctKey, key);
  }

  if (!canMaoriTenseExercise(card)) {
    return (
      <div className="bg-slate-800 rounded-2xl p-6 text-center text-slate-400 text-sm" role="status">
        Preparing next card...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-8 text-center space-y-2">
        <p className="text-slate-400 text-sm">Choose the te reo tense/aspect frame</p>
        <div className="text-2xl text-cyan-400 font-semibold">{card.english}</div>
        <div className="text-slate-500 text-sm">{card.verb_root ? `base: ${card.verb_root}` : 'tense pattern'}</div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {options.map(opt => {
          const isCorrect = opt.key === correctKey;
          const isSelected = selected === opt.key;
          let cls = 'w-full py-4 px-5 rounded-xl text-left font-medium transition-all border-2 ';
          if (!selected) cls += 'border-slate-700 bg-slate-800 text-slate-200 hover:border-cyan-400 hover:bg-slate-700';
          else if (isSelected && isCorrect) cls += 'border-green-500 bg-green-500/20 text-green-400';
          else if (isSelected && !isCorrect) cls += 'border-red-500 bg-red-500/20 text-red-400';
          else if (isCorrect) cls += 'border-green-500 bg-green-500/10 text-green-400';
          else cls += 'border-slate-700 bg-slate-800 text-slate-400 opacity-50';
          return (
            <button key={opt.key} className={cls} onClick={() => choose(opt.key)}>
              <span className="block text-lg font-bold">{opt.label}</span>
              <span className="block text-xs text-slate-500 mt-1">{opt.role}</span>
            </button>
          );
        })}
      </div>

      {selected && selected !== correctKey && (
        <div className="bg-slate-800 rounded-xl p-3 text-center space-y-1">
          <span className="text-slate-400 text-sm">Answer: </span>
          <span className="text-green-400 font-semibold">{card.swahili}</span>
        </div>
      )}
    </div>
  );
}
