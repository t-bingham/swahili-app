import { useState } from 'react';
import type { CardWithState } from '../../types';
import { MorphemeBreakdown, RegisterBadge } from './MorphemeBreakdown';

interface Props {
  card: CardWithState;
  onReveal: () => void;
  revealed: boolean;
  hint?: string;
  direction?: 'sw_to_en' | 'en_to_sw';
  showPronunciation?: boolean;
  showExamples?: boolean;
  showMorphemeHints?: boolean;
}

export default function FlashCard({ card, onReveal, revealed, hint, direction = 'sw_to_en', showPronunciation = true, showExamples = true, showMorphemeHints = false }: Props) {
  const swFirst = direction === 'sw_to_en';
  const front = swFirst ? card.swahili : card.english;
  const back  = swFirst ? card.english  : card.swahili;
  const frontEx = swFirst ? card.example_sentences[0]?.swahili : card.example_sentences[0]?.english;
  const backEx  = swFirst ? card.example_sentences[0]?.english : card.example_sentences[0]?.swahili;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-8 text-center min-h-48 flex flex-col items-center justify-center">
        {!swFirst && (
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Translate to Swahili</div>
        )}
        <div className="text-4xl font-bold text-slate-100 mb-2">{front}</div>
        {swFirst && card.pronunciation && showPronunciation && (
          <div className="text-slate-500 text-sm italic">[{card.pronunciation}]</div>
        )}
        {hint && !revealed && (
          <div className="mt-3 px-3 py-1 bg-slate-700/60 rounded-lg text-slate-400 text-xs">{hint}</div>
        )}
        {frontEx && !revealed && showExamples && (
          <div className="mt-4 text-slate-600 text-sm">"{frontEx}"</div>
        )}
      </div>

      {revealed ? (
        <div className="bg-slate-800/50 rounded-2xl p-6 text-center">
          <div className="text-2xl text-cyan-400 font-semibold mb-2">{back}</div>
          {!swFirst && card.pronunciation && showPronunciation && (
            <div className="text-slate-500 text-sm italic mt-1">[{card.pronunciation}]</div>
          )}
          {backEx && showExamples && (
            <div className="text-slate-400 text-sm mt-3 italic">"{backEx}"</div>
          )}
          {card.cultural_note && (
            <div className="mt-3 px-3 py-2 bg-amber-900/20 border border-amber-700/30 rounded-lg text-amber-300/80 text-xs text-left">
              {card.cultural_note}
            </div>
          )}
          {showMorphemeHints && <MorphemeBreakdown card={card} />}
          <div className="mt-3 flex gap-2 justify-center flex-wrap">
            {card.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">{tag}</span>
            ))}
            <RegisterBadge register={card.register} />
          </div>
        </div>
      ) : (
        <button
          onClick={onReveal}
          className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-2xl text-lg transition-colors"
        >
          Reveal Answer
        </button>
      )}
    </div>
  );
}
