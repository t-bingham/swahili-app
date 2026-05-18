import { Fragment } from 'react';
import type { CardWithState, CardRegister } from '../../types';

// ─── Register badge ───────────────────────────────────────────────────────────

const REGISTER_STYLE: Partial<Record<CardRegister, { bg: string; text: string; label: string }>> = {
  formal:   { bg: 'bg-blue-900/50 border border-blue-700',     text: 'text-blue-300',   label: 'Formal'   },
  informal: { bg: 'bg-amber-900/50 border border-amber-700',   text: 'text-amber-300',  label: 'Informal' },
  slang:    { bg: 'bg-orange-900/50 border border-orange-700', text: 'text-orange-300', label: 'Slang'    },
  literary: { bg: 'bg-purple-900/50 border border-purple-700', text: 'text-purple-300', label: 'Literary' },
  mixed:    { bg: 'bg-teal-900/50 border border-teal-700',     text: 'text-teal-300',   label: 'Mixed'    },
};

export function RegisterBadge({ register }: { register?: CardRegister }) {
  if (!register) return null;
  const style = REGISTER_STYLE[register];
  if (!style) return null;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

// ─── Morpheme breakdown pill-row ──────────────────────────────────────────────

export function MorphemeBreakdown({ card }: { card: CardWithState }) {
  const slots = card.morpheme_breakdown;
  if (!slots?.length) return null;

  return (
    <div className="flex flex-wrap gap-1 justify-center items-end mt-3">
      {slots.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className="text-slate-600 text-xs self-center px-0.5" aria-hidden>·</span>
          )}
          <div className={`flex flex-col items-center px-2 py-1 rounded-lg ${
            s.slot === 'verb_root'
              ? 'bg-cyan-900/40 border border-cyan-700/50'
              : 'bg-slate-700/60'
          }`}>
            <span className={`text-sm font-mono font-semibold ${
              s.slot === 'verb_root' ? 'text-cyan-300' : 'text-slate-300'
            }`}>{s.morpheme}</span>
            <span className="text-xs text-slate-500 leading-tight mt-0.5">{s.gloss}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
