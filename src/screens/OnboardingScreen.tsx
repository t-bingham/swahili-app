import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProfile, getCurrentUser } from '../database/db';

const WORD_OPTIONS = [5, 10, 15, 20, 30];

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const [newWordsPerDay, setNewWordsPerDay] = useState(10);

  async function finish() {
    const user = getCurrentUser() ?? 'default';
    const displayName = user.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    await createProfile(displayName, { new_words_per_day: newWordsPerDay, reviews_per_day: 20, new_word_rate: 20 });
    navigate('/app/home');
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-6">
      <div className="flex-1 flex flex-col justify-center space-y-8 max-w-sm mx-auto w-full">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">How many new words per day?</h2>
          <p className="text-slate-400 text-sm">You can change this anytime in Settings.</p>
        </div>

        <div className="space-y-3">
          {WORD_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => setNewWordsPerDay(n)}
              className={`w-full py-4 px-5 rounded-xl border-2 text-left transition-colors flex items-center justify-between ${
                newWordsPerDay === n
                  ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span className="text-lg font-semibold">{n} new words / day</span>
              {newWordsPerDay === n && <span className="text-cyan-400">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={finish}
        className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-2xl text-lg transition-colors"
      >
        Start Learning →
      </button>
    </div>
  );
}
