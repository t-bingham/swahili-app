import { useState, useEffect } from 'react';
import { countCardsByDepth, getRetentionByCategory, getDailyActivity, getTotalReviews } from '../database/db';

const DEPTH_LABELS: Record<number, string> = {
  1: 'New', 2: 'Learning', 2.5: 'Fast-track',
  3: 'Young', 4: 'Mature', 4.5: 'Fast-mature',
  5.1: 'Expert', 5.2: 'Master', 5.3: 'Legend',
};
const DEPTH_COLORS: Record<number, string> = {
  1: 'bg-slate-600', 2: 'bg-blue-500', 2.5: 'bg-cyan-400',
  3: 'bg-teal-400', 4: 'bg-green-400', 4.5: 'bg-emerald-300',
  5.1: 'bg-purple-400', 5.2: 'bg-violet-400', 5.3: 'bg-fuchsia-400',
};

export default function StatsScreen() {
  const [depths, setDepths] = useState<Record<number, number>>({});
  const [retention, setRetention] = useState<Array<{ category: string; retention: number }>>([]);
  const [activity, setActivity] = useState<Array<{ date: string; count: number }>>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      countCardsByDepth(),
      getRetentionByCategory(),
      getDailyActivity(84),
      getTotalReviews(),
    ]).then(([d, r, a, total]) => {
      setDepths(d);
      setRetention(r);
      setActivity(a);
      setTotalReviews(total);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;

  const totalCards = Object.values(depths).reduce((s, c) => s + c, 0);
  const maxActivity = Math.max(1, ...activity.map(a => a.count));

  // Build 84-day activity grid
  const today = new Date();
  const activityMap = new Map(activity.map(a => [a.date, a.count]));
  const grid = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (83 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return { dateStr, count: activityMap.get(dateStr) ?? 0 };
  });

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 pt-2">Stats</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Reviews', value: totalReviews, color: 'text-slate-100' },
          { label: 'Learned', value: Object.entries(depths).filter(([d]) => Number(d) >= 2).reduce((s, [, c]) => s + c, 0), color: 'text-cyan-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Cards by depth */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h2 className="text-slate-400 text-sm font-medium mb-4">Cards by Level</h2>
        <div className="space-y-2">
          {Object.entries(depths)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([depth, count]) => {
              const d = Number(depth);
              const pct = totalCards > 0 ? (count / totalCards) * 100 : 0;
              return (
                <div key={depth} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-slate-400 shrink-0">{DEPTH_LABELS[d] ?? depth}</div>
                  <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${DEPTH_COLORS[d] ?? 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-10 text-right text-xs text-slate-400">{count}</div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Retention by category */}
      {retention.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-slate-400 text-sm font-medium mb-4">Retention by Type</h2>
          <div className="space-y-2">
            {retention.map(r => (
              <div key={r.category} className="flex items-center gap-3">
                <div className="w-24 text-xs text-slate-400 capitalize shrink-0">{r.category}</div>
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.retention >= 80 ? 'bg-green-400' : r.retention >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${r.retention}%` }}
                  />
                </div>
                <div className="w-12 text-right text-xs text-slate-400">{r.retention}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity heatmap */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h2 className="text-slate-400 text-sm font-medium mb-4">Activity (12 weeks)</h2>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
          {Array.from({ length: 12 }, (_, week) => (
            <div key={week} className="flex flex-col gap-1">
              {grid.slice(week * 7, week * 7 + 7).map(day => {
                const intensity = day.count / maxActivity;
                const opacity = day.count === 0 ? 'opacity-10' : intensity < 0.33 ? 'opacity-40' : intensity < 0.66 ? 'opacity-70' : 'opacity-100';
                return (
                  <div
                    key={day.dateStr}
                    title={`${day.dateStr}: ${day.count} reviews`}
                    className={`aspect-square rounded-sm bg-cyan-400 ${opacity}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
