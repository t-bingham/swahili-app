import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnits, getAllUnitProgress, getUnitMasteryStats } from '../database/db';
import type { Unit, UnitProgress } from '../types';

const LEVEL_LABELS: Record<number, string> = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };

function computeStatus(unit: Unit, progress: Map<string, UnitProgress>): UnitProgress['status'] {
  const prog = progress.get(unit.id);
  if (prog?.status === 'completed') return 'completed';
  if (prog?.status === 'in_progress') return 'in_progress';
  const prereqsMet =
    unit.prerequisite_ids.length === 0 ||
    unit.prerequisite_ids.every(id => progress.get(id)?.status === 'completed');
  if (!prereqsMet) return 'locked';
  return 'available';
}

function RetentionBar({ retained, total }: { retained: number; total: number }) {
  const pct = total > 0 ? Math.round((retained / total) * 100) : 0;
  return (
    <div className="mt-2.5">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Retention</span>
        <span>{retained}/{total} words</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-green-400' : 'bg-cyan-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function UnitMapScreen() {
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [progress, setProgress] = useState<Map<string, UnitProgress>>(new Map());
  const [masteryStats, setMasteryStats] = useState<Map<string, { total: number; introduced: number; retained: number }>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUnits(), getAllUnitProgress(), getUnitMasteryStats()]).then(([us, progs, stats]) => {
      setUnits(us);
      setProgress(new Map(progs.map(p => [p.unit_id, p])));
      setMasteryStats(stats);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;

  const visibleUnits = [...units]
    .filter(u => u.id !== 'unit-00-placement')
    .sort((a, b) => a.level !== b.level ? a.level - b.level : a.order_index - b.order_index);

  const displayNumber = new Map(visibleUnits.map((u, i) => [u.id, i + 1]));

  const grouped = [1, 2, 3].map(level => ({
    level: level as 1 | 2 | 3,
    units: visibleUnits.filter(u => u.level === level),
  })).filter(g => g.units.length > 0);

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto pb-6">
      <h1 className="text-2xl font-bold text-slate-100 pt-2">Units</h1>
      {grouped.map(({ level, units: lvlUnits }) => (
        <div key={level}>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            {LEVEL_LABELS[level]}
          </h2>
          <div className="space-y-2">
            {lvlUnits.map(unit => {
              const status = computeStatus(unit, progress);
              const stats = masteryStats.get(unit.id);
              const isLocked = status === 'locked';

              const borderColor =
                status === 'completed' ? 'border-green-500/50' :
                status === 'in_progress' ? 'border-cyan-400/50' :
                status === 'available' ? 'border-slate-600 hover:border-cyan-400 cursor-pointer' :
                'border-slate-700 opacity-50 cursor-not-allowed';

              const statusBadge =
                status === 'completed' ? <span className="text-xs text-green-400 font-medium">✓ Complete</span> :
                status === 'in_progress' ? <span className="text-xs text-cyan-400 font-medium">In progress</span> :
                status === 'locked' ? <span className="text-xs text-slate-500">🔒 Locked</span> :
                null;

              return (
                <div
                  key={unit.id}
                  onClick={() => !isLocked && navigate(`/app/units/${unit.id}`)}
                  className={`bg-slate-800 border-2 rounded-xl p-4 transition-colors ${borderColor}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-slate-500">Unit {displayNumber.get(unit.id)}</span>
                        {statusBadge}
                      </div>
                      <h3 className="font-semibold text-slate-100">{unit.name}</h3>
                      <p className="text-slate-400 text-sm mt-0.5 line-clamp-2">{unit.description}</p>
                    </div>
                    <div className="text-right shrink-0 text-xs text-slate-500">
                      {unit.estimated_hours}h
                    </div>
                  </div>

                  {status !== 'locked' && stats && stats.introduced > 0 && (
                    <RetentionBar retained={stats.retained} total={stats.total} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
