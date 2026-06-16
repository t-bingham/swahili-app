import { useState, useRef, useEffect } from 'react';
import type { CardWithState } from '../../types';
import type { LanguageAdapter } from '../../languages';

interface Props {
  card: CardWithState;
  language: LanguageAdapter;
  onKnew: () => void;
  onDidntKnow: () => void;
  onAlreadyKnow?: () => void;
}

export default function RecallPrompt({ card, language, onKnew, onDidntKnow, onAlreadyKnow }: Props) {
  const [attempted, setAttempted] = useState(false);
  const firstBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!attempted) firstBtnRef.current?.focus(); }, [card.id, attempted]);

  const hint = card.type === 'conjugation' && card.conjugation_key
    ? `(conjugation of ${card.verb_root ?? ''})`
    : card.type === 'grammar' && card.noun_class
    ? `(${card.noun_class} noun)`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800 rounded-2xl p-8 text-center min-h-48 flex flex-col items-center justify-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400/60 mb-1">
          New word
        </span>
        <div className="text-4xl font-bold text-slate-100">{language.getTargetText(card)}</div>
        {card.pronunciation && (
          <div className="text-slate-500 text-sm italic">[{card.pronunciation}]</div>
        )}
        {hint && <div className="text-slate-400 text-xs">{hint}</div>}
      </div>

      {!attempted ? (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm text-center">Do you know what this means?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              ref={firstBtnRef}
              onClick={() => { setAttempted(true); onKnew(); }}
              className="py-4 rounded-xl border-2 border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 font-semibold transition-colors"
            >
              I know it
            </button>
            <button
              onClick={() => { setAttempted(true); onDidntKnow(); }}
              className="py-4 rounded-xl border-2 border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold transition-colors"
            >
              Show me
            </button>
          </div>
          {onAlreadyKnow && (
            <button
              onClick={() => { setAttempted(true); onAlreadyKnow(); }}
              className="w-full py-2.5 text-slate-600 hover:text-slate-400 text-xs transition-colors"
            >
              I already know this - skip it
            </button>
          )}
        </div>
      ) : (
        <div className="py-3 text-center text-slate-500 text-sm">Revealing...</div>
      )}
    </div>
  );
}
