import { useState } from 'react';
import type { CardWithState } from '../../types';

interface Props {
  card: CardWithState;
  onAnswer: (correct: boolean, chosen: string) => void;
}

const PARTICLES = [
  { text: '은 / 는', role: 'topic / contrast' },
  { text: '이 / 가', role: 'subject / new focus' },
  { text: '을 / 를', role: 'object' },
  { text: '에', role: 'to / at a place or time' },
  { text: '에서', role: 'at / from where action happens' },
  { text: '도', role: 'also / too' },
  { text: '의', role: 'possessive' },
  { text: '에게 / 한테', role: 'to / for a person' },
  { text: '으로 / 로', role: 'by / with / toward' },
  { text: '와 / 과', role: 'and / with' },
  { text: '하고', role: 'and / with, conversational' },
  { text: '부터 / 까지', role: 'from / until' },
  { text: '보다', role: 'than / comparison' },
  { text: '만', role: 'only / just' },
];

function normalizeParticle(text: string): string {
  return text.replace(/\s+/g, '').replace(/[()]/g, '');
}

function buildOptions(correct: string) {
  const normalizedCorrect = normalizeParticle(correct);
  const matching = PARTICLES.find(p => normalizeParticle(p.text) === normalizedCorrect) ?? { text: correct, role: 'grammar pattern' };
  const pool = PARTICLES.filter(p => normalizeParticle(p.text) !== normalizedCorrect);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const options = [matching, ...pool.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

export default function KoreanParticleExercise({ card, onAnswer }: Props) {
  const [options] = useState(() => buildOptions(card.swahili));
  const [selected, setSelected] = useState<string | null>(null);
  const correct = normalizeParticle(card.swahili);

  function choose(opt: string) {
    if (selected) return;
    setSelected(opt);
    onAnswer(normalizeParticle(opt) === correct, opt);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-8 text-center space-y-2">
        <p className="text-slate-400 text-sm">Choose the Korean particle or pattern</p>
        <div className="text-2xl text-cyan-400 font-semibold">{card.english}</div>
        {card.pronunciation && <div className="text-slate-500 text-sm italic">[{card.pronunciation}]</div>}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {options.map(opt => {
          const isCorrect = normalizeParticle(opt.text) === correct;
          const isSelected = selected === opt.text;
          let cls = 'w-full py-4 px-5 rounded-xl text-left font-medium transition-all border-2 ';
          if (!selected) cls += 'border-slate-700 bg-slate-800 text-slate-200 hover:border-cyan-400 hover:bg-slate-700';
          else if (isSelected && isCorrect) cls += 'border-green-500 bg-green-500/20 text-green-400';
          else if (isSelected && !isCorrect) cls += 'border-red-500 bg-red-500/20 text-red-400';
          else if (isCorrect) cls += 'border-green-500 bg-green-500/10 text-green-400';
          else cls += 'border-slate-700 bg-slate-800 text-slate-400 opacity-50';
          return (
            <button key={opt.text} className={cls} onClick={() => choose(opt.text)}>
              <span className="block text-lg font-bold">{opt.text}</span>
              <span className="block text-xs text-slate-500 mt-1">{opt.role}</span>
            </button>
          );
        })}
      </div>

      {selected && selected !== card.swahili && card.cultural_note && (
        <div className="px-3 py-2 bg-amber-900/20 border border-amber-700/30 rounded-xl text-amber-300/80 text-xs">
          {card.cultural_note}
        </div>
      )}
    </div>
  );
}
