import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnits, getAllUnitProgress, getUnitMasteryStats } from '../database/db';
import { computeStatus } from '../utils/unitStatus';
import { unitsForTrack, type UnitTrack } from '../utils/unitTracks';
import NounClassReference from '../components/NounClassReference';
import { getCurrentLanguage } from '../database/db';
import { getLanguage } from '../data/languages';
import type { Unit, UnitProgress } from '../types';

const LEVEL_LABELS: Record<number, string> = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };

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

// ─── Vocabulary unit card (cyan accent) ──────────────────────────────────────

interface VocabCardProps {
  unit: Unit;
  displayNum: number;
  status: UnitProgress['status'];
  stats?: { total: number; introduced: number; retained: number };
  onClick: () => void;
}

function VocabUnitCard({ unit, displayNum, status, stats, onClick }: VocabCardProps) {
  const isLocked = status === 'locked';

  const borderColor =
    status === 'completed'   ? 'border-green-500/50' :
    status === 'in_progress' ? 'border-cyan-400/50' :
    status === 'available'   ? 'border-slate-600 hover:border-cyan-400 cursor-pointer' :
    'border-slate-700 opacity-50 cursor-not-allowed';

  const statusBadge =
    status === 'completed'   ? <span className="text-xs text-green-400 font-medium">✓ Complete</span> :
    status === 'in_progress' ? <span className="text-xs text-cyan-400 font-medium">In progress</span> :
    status === 'locked'      ? <span className="text-xs text-slate-500">🔒 Locked</span> :
    null;

  return (
    <div
      role="button"
      tabIndex={isLocked ? -1 : 0}
      aria-disabled={isLocked || undefined}
      aria-label={`Unit ${displayNum}: ${unit.name}${isLocked ? ' (locked)' : ''}`}
      onClick={() => !isLocked && onClick()}
      onKeyDown={e => { if (!isLocked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      className={`bg-slate-800 border-2 rounded-xl p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${borderColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs text-slate-500">Unit {displayNum}</span>
            {statusBadge}
          </div>
          <h3 className="font-semibold text-slate-100">{unit.name}</h3>
          <p className="text-slate-400 text-sm mt-0.5 line-clamp-2">{unit.description}</p>
        </div>
        <div className="text-right shrink-0 text-xs text-slate-500">{unit.estimated_hours}h</div>
      </div>
      {status !== 'locked' && stats && stats.introduced > 0 && (
        <RetentionBar retained={stats.retained} total={stats.total} />
      )}
    </div>
  );
}

// ─── Grammar unit card (amber accent) ────────────────────────────────────────

interface GrammarCardProps {
  unit: Unit;
  displayNum: number;
  status: UnitProgress['status'];
  stats?: { total: number; introduced: number; retained: number };
  onClick: () => void;
}

function GrammarUnitCard({ unit, displayNum, status, stats, onClick }: GrammarCardProps) {
  const isLocked = status === 'locked';

  const borderColor =
    status === 'completed'   ? 'border-green-500/50' :
    status === 'in_progress' ? 'border-amber-400/60' :
    status === 'available'   ? 'border-amber-700/50 hover:border-amber-400 cursor-pointer' :
    'border-slate-700/60 opacity-50 cursor-not-allowed';

  const statusBadge =
    status === 'completed'   ? <span className="text-xs text-green-400 font-medium">✓ Complete</span> :
    status === 'in_progress' ? <span className="text-xs text-amber-400 font-medium">In progress</span> :
    status === 'locked'      ? <span className="text-xs text-slate-500">🔒 Locked</span> :
    null;

  return (
    <div
      role="button"
      tabIndex={isLocked ? -1 : 0}
      aria-disabled={isLocked || undefined}
      aria-label={`${unit.name}${isLocked ? ' (locked)' : ''}`}
      onClick={() => !isLocked && onClick()}
      onKeyDown={e => { if (!isLocked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      className={`bg-slate-800/80 border-2 rounded-xl p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${borderColor}`}
    >
      <div className="flex items-start gap-3">
        {/* Grammar label badge */}
        <div className={`shrink-0 min-w-[3rem] text-center px-2 py-1 rounded-lg text-xs font-bold mt-0.5 ${
          isLocked
            ? 'bg-slate-700 text-slate-500'
            : status === 'completed'
              ? 'bg-green-500/15 text-green-400'
              : 'bg-amber-500/15 text-amber-400'
        }`}>
          {isLocked ? '🔒' : displayNum}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-slate-100">{unit.name}</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-slate-400 text-sm line-clamp-1">{unit.description}</p>
          </div>
          {statusBadge && <div className="mt-1">{statusBadge}</div>}
        </div>
        <div className="text-right shrink-0 text-xs text-slate-500">{unit.estimated_hours}h</div>
      </div>
      {status !== 'locked' && stats && stats.introduced > 0 && (
        <div className="mt-2.5">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Retention</span>
            <span>{stats.retained}/{stats.total} items</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                stats.retained / Math.max(stats.total, 1) >= 0.7 ? 'bg-green-400' : 'bg-amber-400'
              }`}
              style={{ width: `${stats.total > 0 ? Math.round((stats.retained / stats.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UnitMapScreen({ track }: { track: UnitTrack }) {
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

  const vocabUnits = unitsForTrack(units, 'vocabulary');
  const grammarUnits = unitsForTrack(units, 'grammar');
  const activeUnits = unitsForTrack(units, track);
  const displayNumber = new Map(activeUnits.map((u, i) => [u.id, i + 1]));

  // Group vocab units by level
  const grouped = ([1, 2, 3] as const).map(level => ({
    level,
    units: vocabUnits.filter(u => u.level === level),
  })).filter(g => g.units.length > 0);

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto pb-6">
      <h1 className="text-2xl font-bold text-slate-100 pt-2">
        {track === 'grammar' ? 'Grammar' : 'Units'}
      </h1>

      {/* ── Vocabulary track ─────────────────────────────────────────────── */}
      {track === 'vocabulary' && grouped.map(({ level, units: lvlUnits }) => (
        <div key={level}>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            {LEVEL_LABELS[level]}
          </h2>
          <div className="space-y-2">
            {lvlUnits.map(unit => (
              <VocabUnitCard
                key={unit.id}
                unit={unit}
                displayNum={displayNumber.get(unit.id)!}
                status={computeStatus(unit, progress)}
                stats={masteryStats.get(unit.id)}
                onClick={() => navigate(`/app/units/${unit.id}`)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* ── Grammar track ────────────────────────────────────────────────── */}
      {track === 'grammar' && grammarUnits.length > 0 && (
        <div>
          <p className="text-slate-500 text-xs mb-4 leading-relaxed">
            {getLanguage(getCurrentLanguage()).id === 'ko' ? (
              <>
                How Korean works: particles, speech levels, and sentence structure.
                <br />
                <span className="text-slate-400">You're learning Standard (Seoul) Korean — 표준어.</span>
              </>
            ) : (
              <>
                How Swahili works: noun classes, verb tenses, agreement, and sentence structure.
                <br />
                <span className="text-slate-400">You're learning Standard Swahili (Kiunguja / Zanzibar coastal basis).</span>
              </>
            )}
          </p>
          {getLanguage(getCurrentLanguage()).features.nounClass && <div className="mb-4"><NounClassReference /></div>}
          <div className="space-y-2">
            {grammarUnits.map(unit => (
              <GrammarUnitCard
                key={unit.id}
                unit={unit}
                displayNum={displayNumber.get(unit.id)!}
                status={computeStatus(unit, progress)}
                stats={masteryStats.get(unit.id)}
                onClick={() => navigate(`/app/grammar/${unit.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
