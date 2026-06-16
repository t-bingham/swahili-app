import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jamoFor, type HangulSet, type Jamo } from '../data/hangul';
import HangulExercise from '../components/exercises/HangulExercise';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SETS: { value: HangulSet; label: string; sub: string }[] = [
  { value: 'consonants', label: 'Consonants', sub: '19 letters · 자음' },
  { value: 'vowels',     label: 'Vowels',     sub: '21 letters · 모음' },
  { value: 'all',        label: 'All letters', sub: '40 jamo' },
];

export default function HangulScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'setup' | 'quiz' | 'done'>('setup');
  const [set, setSet] = useState<HangulSet>('consonants');
  const [queue, setQueue] = useState<Jamo[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const current = queue[idx];

  // Stable options per question: correct romanization + 3 distractors from the same set.
  const options = useMemo(() => {
    if (!current) return [];
    const distractors = shuffle(jamoFor(set).filter(j => j.rom !== current.rom))
      .slice(0, 3)
      .map(j => j.rom);
    return shuffle([current.rom, ...distractors]);
  }, [current, set]);

  function start() {
    setQueue(shuffle(jamoFor(set)));
    setIdx(0);
    setScore(0);
    setPhase('quiz');
  }

  function handleAnswer(correct: boolean) {
    if (correct) setScore(s => s + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setIdx(i => {
        if (i + 1 >= queue.length) { setPhase('done'); return i; }
        return i + 1;
      });
    }, 900);
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="p-5 space-y-6 max-w-lg mx-auto">
        <div className="pt-2">
          <p className="text-pink-400 text-sm font-semibold">🇰🇷 Korean</p>
          <h1 className="text-2xl font-bold text-slate-100">Learn the alphabet <span lang="ko" className="text-pink-300">한글</span></h1>
          <p className="text-slate-400 text-sm mt-1">Hangul is featural and regular — you can read it in an afternoon. Pick a set to drill.</p>
        </div>

        <div className="space-y-3">
          {SETS.map(s => (
            <button
              key={s.value}
              onClick={() => setSet(s.value)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${
                set === s.value ? 'border-pink-500 bg-pink-500/10' : 'border-slate-700 bg-slate-800 hover:border-slate-600'
              }`}
            >
              <p className="text-slate-100 font-semibold">{s.label}</p>
              <p className="text-slate-400 text-sm">{s.sub}</p>
            </button>
          ))}
        </div>

        <button
          onClick={start}
          className="w-full py-4 bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold text-lg rounded-2xl transition-colors"
        >
          Start →
        </button>
        <button onClick={() => navigate('/app/home')} className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors">
          ← Back to home
        </button>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const total = queue.length;
    const pct = total ? Math.round((score / total) * 100) : 0;
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-6xl">{pct >= 80 ? '🎉' : '💪'}</div>
          <h2 className="text-2xl font-bold text-slate-100">{score} / {total} correct</h2>
          <p className="text-slate-400">{pct >= 80 ? 'Great recognition!' : 'Keep drilling — repetition is the whole game with Hangul.'}</p>
          <div className="flex flex-col gap-2 pt-2">
            <button onClick={start} className="w-full py-3 bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold rounded-xl transition-colors">
              Practice again
            </button>
            <button onClick={() => setPhase('setup')} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition-colors">
              Choose another set
            </button>
            <button onClick={() => navigate('/app/home')} className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors">
              ← Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between p-4">
        <button onClick={() => setPhase('setup')} className="text-slate-400 hover:text-slate-200 text-sm">← Exit</button>
        <span className="text-slate-500 text-sm">{idx + 1} / {queue.length}</span>
        <span className="text-pink-400 text-sm font-semibold">{score} ✓</span>
      </div>
      <div className="h-1 bg-slate-800 mx-4 rounded-full overflow-hidden">
        <div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${((idx) / Math.max(queue.length, 1)) * 100}%` }} />
      </div>
      <div className="flex-1 p-4">
        {current && <HangulExercise key={idx} jamo={current} options={options} onAnswer={handleAnswer} />}
      </div>
    </div>
  );
}
