import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, countOverdueCards, getLastSession, countCardsByDepth } from '../database/db';
import type { Profile, Session } from '../types';

export default function HomeScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const [totalLearned, setTotalLearned] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [p, due, sess, depths] = await Promise.all([
        getProfile(),
        countOverdueCards(new Date().toISOString()),
        getLastSession(),
        countCardsByDepth(),
      ]);
      setProfile(p);
      setDueCount(due);
      setLastSession(sess);
      const learned = Object.entries(depths)
        .filter(([d]) => Number(d) >= 2)
        .reduce((s, [, c]) => s + c, 0);
      setTotalLearned(learned);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;
  }

  return (
    <div className="p-5 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="pt-2">
        <p className="text-slate-400 text-sm">Welcome back</p>
        <h1 className="text-2xl font-bold text-slate-100">{profile?.display_name}</h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-cyan-400">{dueCount}</div>
          <div className="text-slate-400 text-sm mt-1">cards due</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-purple-400">{totalLearned}</div>
          <div className="text-slate-400 text-sm mt-1">words learned</div>
        </div>
      </div>

      {/* Start session */}
      <button
        onClick={() => navigate('/app/learn')}
        className="w-full py-5 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 font-bold text-xl rounded-2xl transition-colors shadow-lg shadow-cyan-500/20"
      >
        {dueCount > 0 ? `Study Now · ${dueCount} due` : 'Start Session'}
      </button>

      {/* Last session */}
      {lastSession && (
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm mb-3">Last session</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-semibold text-slate-100">{lastSession.cards_reviewed}</div>
              <div className="text-xs text-slate-500">reviewed</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-400">
                {Math.round(lastSession.recall_rate * 100)}%
              </div>
              <div className="text-xs text-slate-500">recall</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-cyan-400">{lastSession.new_words_introduced}</div>
              <div className="text-xs text-slate-500">new words</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
