interface Props {
  onRate: (rating: 1 | 2 | 3 | 4 | 5) => void;
  // simplified: wrong answer — just Again vs Got It
  showSimplified?: boolean;
  // didntKnow: shown after "Show me" on a new word — only two options
  showDidntKnow?: boolean;
}

const ALL_RATINGS: Array<{ value: 1 | 2 | 3 | 4 | 5; label: string; sub: string; cls: string }> = [
  { value: 1, label: 'Again',   sub: 'Forgot',    cls: 'border-red-500/50    bg-red-500/10    text-red-400    hover:bg-red-500/20' },
  { value: 2, label: 'Hard',    sub: 'Struggled', cls: 'border-orange-500/50 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' },
  { value: 3, label: 'Good',    sub: 'Correct',   cls: 'border-green-500/50  bg-green-500/10  text-green-400  hover:bg-green-500/20' },
  { value: 4, label: 'Easy',    sub: 'Effortless',cls: 'border-cyan-500/50   bg-cyan-500/10   text-cyan-400   hover:bg-cyan-500/20' },
  { value: 5, label: 'Instant', sub: 'Immediate', cls: 'border-purple-500/50 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20' },
];

export default function RatingButtons({ onRate, showSimplified = false, showDidntKnow = false }: Props) {
  // "Show me" path — they admitted they didn't know it; just confirm and move on
  if (showDidntKnow) {
    return (
      <div>
        <p className="text-slate-500 text-xs text-center mb-3">It's been noted — it'll come back soon</p>
        <button
          onClick={() => onRate(1)}
          className="w-full py-3 rounded-xl border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold transition-colors"
        >
          Got it, next card
        </button>
      </div>
    );
  }

  // Wrong answer on a non-new card — Again or Got It
  if (showSimplified) {
    return (
      <div>
        <p className="text-slate-500 text-xs text-center mb-3">How well did you recall it?</p>
        <div className="grid grid-cols-2 gap-3">
          {ALL_RATINGS.filter(r => r.value === 1 || r.value === 3).map(r => (
            <button
              key={r.value}
              onClick={() => onRate(r.value)}
              className={`py-3 rounded-xl border text-center transition-all ${r.cls}`}
            >
              <div className="font-semibold text-sm">{r.label}</div>
              <div className="text-xs opacity-70">{r.sub}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Full 5-button rating
  return (
    <div>
      <p className="text-slate-500 text-xs text-center mb-3">How well did you know it?</p>
      <div className="grid grid-cols-5 gap-1.5">
        {ALL_RATINGS.map(r => (
          <button
            key={r.value}
            onClick={() => onRate(r.value)}
            className={`py-3 rounded-xl border text-center transition-all ${r.cls}`}
          >
            <div className="font-semibold text-xs">{r.label}</div>
            <div className="text-xs opacity-60 hidden sm:block">{r.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
