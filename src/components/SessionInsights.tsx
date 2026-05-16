import type { CardWithState, SessionReview, ErrorType } from '../types';

interface Props {
  reviews: SessionReview[];
  queue: CardWithState[];
  recall: number;
  onStudyAgain: () => void;
  onDone: () => void;
}

const STRUCTURAL = new Set([
  'conjugation', 'infinitive', 'production', 'plural', 'fill-blank',
  'adjective-agreement', 'noun-class', 'object-infix', 'relative-pronouns',
  'demonstratives', 'verbal-noun',
]);

const ERROR_INFO: Record<ErrorType, { label: string; tip: string }> = {
  phonological: {
    label: 'spelling / sound mix-ups',
    tip: 'Swahili vowels are always pure: a=ah, e=eh, i=ee, o=oh, u=oo — no silent letters.',
  },
  semantic: {
    label: 'wrong-word mix-ups',
    tip: 'Link each word to a vivid image or personal story — context anchors memory better than repetition alone.',
  },
  structural: {
    label: 'prefix / suffix errors',
    tip: 'Break words into parts: subject prefix + tense marker + root (e.g. ni-li-soma, u-na-penda).',
  },
};

function formatTag(tag: string): string {
  return tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function SessionInsights({ reviews, queue, recall, onStudyAgain, onDone }: Props) {
  const cardById = new Map(queue.map(c => [c.id, c]));

  // Per-tag accuracy for this session
  const tagStats = new Map<string, { correct: number; total: number }>();
  for (const r of reviews) {
    const card = cardById.get(r.cardId);
    if (!card) continue;
    for (const tag of card.tags) {
      if (STRUCTURAL.has(tag)) continue;
      if (!tagStats.has(tag)) tagStats.set(tag, { correct: 0, total: 0 });
      const s = tagStats.get(tag)!;
      s.total++;
      if (r.rating >= 3) s.correct++;
    }
  }

  const stats = [...tagStats.entries()]
    .filter(([, s]) => s.total >= 2)
    .map(([tag, s]) => ({ tag, correct: s.correct, total: s.total, accuracy: s.correct / s.total }));

  const weakSkills = stats.filter(s => s.accuracy < 0.70).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
  const strongSkills = stats.filter(s => s.accuracy >= 0.90).sort((a, b) => b.accuracy - a.accuracy).slice(0, 3);

  // Dominant error type this session
  const errorCounts: Record<ErrorType, number> = { phonological: 0, semantic: 0, structural: 0 };
  for (const r of reviews) if (r.errorType) errorCounts[r.errorType]++;
  const totalErrors = errorCounts.phonological + errorCounts.semantic + errorCounts.structural;
  const dominantError: ErrorType | null = totalErrors > 0
    ? (Object.entries(errorCounts).sort(([, a], [, b]) => b - a)[0][0] as ErrorType)
    : null;

  return (
    <div className="flex h-full items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-5">

        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-100">Session Done!</h2>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Reviewed', value: reviews.length, color: 'text-slate-100' },
            { label: 'Recall', value: `${Math.round(recall * 100)}%`, color: recall >= 0.8 ? 'text-green-400' : 'text-orange-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-500 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Weak spots */}
        {weakSkills.length > 0 && (
          <div className="bg-slate-800 rounded-2xl p-4 space-y-3">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Needs work</p>
            {weakSkills.map(s => (
              <div key={s.tag} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{formatTag(s.tag)}</span>
                    <span className="text-red-400">{Math.round(s.accuracy * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${s.accuracy * 100}%` }} />
                  </div>
                </div>
                <span className="text-slate-600 text-xs shrink-0">{s.total} cards</span>
              </div>
            ))}

            {/* Error type tip */}
            {dominantError && (
              <div className="pt-1 border-t border-slate-700">
                <p className="text-slate-400 text-xs">
                  Most common: <span className="text-orange-400">{ERROR_INFO[dominantError].label}</span>
                </p>
                <p className="text-slate-500 text-xs mt-1">{ERROR_INFO[dominantError].tip}</p>
              </div>
            )}
          </div>
        )}

        {/* Strong areas */}
        {strongSkills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-slate-500 text-xs self-center">Strong:</span>
            {strongSkills.map(s => (
              <span key={s.tag} className="px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-xs">
                {formatTag(s.tag)} {Math.round(s.accuracy * 100)}%
              </span>
            ))}
          </div>
        )}

        {weakSkills.length === 0 && strongSkills.length === 0 && (
          <p className="text-slate-500 text-sm text-center">Keep going — skill insights appear after a few sessions.</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onStudyAgain} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-xl transition-colors">
            Study again
          </button>
          <button onClick={onDone} className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition-colors">
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
