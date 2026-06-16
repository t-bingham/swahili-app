import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, countOverdueCards, getLastSession, countCardsByDepth, getDailyStats, getCurrentLanguage } from '../database/db';
import { getLanguage } from '../data/languages';
import type { Profile, Session } from '../types';

export default function HomeScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const [totalLearned, setTotalLearned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<{ reviewsToday: number; newWordsToday: number } | null>(null);

  useEffect(() => {
    async function load() {
      const [p, due, sess, depths, ds] = await Promise.all([
        getProfile(),
        countOverdueCards(new Date().toISOString()),
        getLastSession(),
        countCardsByDepth(),
        getDailyStats(),
      ]);
      setProfile(p);
      setDueCount(due);
      setLastSession(sess);
      const learned = Object.entries(depths)
        .filter(([d]) => Number(d) >= 2)
        .reduce((s, [, c]) => s + c, 0);
      setTotalLearned(learned);
      setDailyStats(ds);
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
      <div className="pt-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-slate-400 text-sm">Welcome back</p>
          <h1 className="text-2xl font-bold text-slate-100">{profile?.display_name}</h1>
        </div>
        <button
          onClick={async () => {
            const { closeDatabase } = await import('../database/db');
            await closeDatabase();
            // Drop sessionStorage's language so the picker doesn't auto-restore on next openDatabase
            sessionStorage.removeItem('currentLanguage');
            navigate('/');
          }}
          className="mt-1 py-1.5 px-3 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
          aria-label="Back to language selection"
        >
          <span aria-hidden="true">{getLanguage(getCurrentLanguage()).flag}</span> Change language
        </button>
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

      {/* Korean: Hangul trainer — only shown for Korean learners */}
      {getLanguage(getCurrentLanguage()).features.hangul && (
        <button
          onClick={() => navigate('/app/hangul')}
          className="w-full p-4 rounded-2xl border-2 border-pink-500/40 bg-pink-500/10 hover:bg-pink-500/20 text-left transition-colors flex items-center gap-3"
        >
          <span className="text-2xl" aria-hidden="true">🇰🇷</span>
          <div>
            <p className="text-slate-100 font-semibold">Learn the Korean alphabet <span lang="ko" className="text-pink-300">한글</span></p>
            <p className="text-slate-400 text-sm">New — read Hangul in an afternoon</p>
          </div>
        </button>
      )}

      {/* Daily progress */}
      {profile && dailyStats !== null && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Today's reviews</span>
            <span>{dailyStats.reviewsToday} / {profile.settings.reviews_per_day ?? 20}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (dailyStats.reviewsToday / (profile.settings.reviews_per_day ?? 20)) * 100)}%` }}
            />
          </div>
        </div>
      )}

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
