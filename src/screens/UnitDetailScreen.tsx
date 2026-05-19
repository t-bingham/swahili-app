import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUnits, getAllUnitProgress, getUnitCardsWithState } from '../database/db';
import GrammarNotes from '../components/GrammarNotes';
import { computeLessons } from '../utils/lessons';
import { computeStatus } from '../utils/unitStatus';
import type { Unit, UnitProgress, CardWithState } from '../types';
import type { LessonInfo } from '../utils/lessons';

// ─── Lesson row ───────────────────────────────────────────────────────────────

function LessonRow({ lesson, unitId, isFirst }: { lesson: LessonInfo; unitId: string; isFirst: boolean }) {
  const navigate = useNavigate();
  const { index, cards, status } = lesson;
  const isLocked = status === 'locked';

  const preview = cards.slice(0, 4).map(c => c.swahili).join(', ') +
    (cards.length > 4 ? '…' : '');

  const statusBadge =
    status === 'mastered' ? <span className="text-xs text-green-400 font-medium">✓ Mastered</span> :
    status === 'complete' ? <span className="text-xs text-cyan-400 font-medium">✓ Done</span> :
    null;

  const borderColor =
    status === 'mastered' ? 'border-green-500/40' :
    status === 'complete' ? 'border-cyan-500/30' :
    status === 'available' ? 'border-slate-600 hover:border-cyan-400 cursor-pointer' :
    'border-slate-800 opacity-50';

  const buttonLabel =
    status === 'mastered' ? 'Review' :
    status === 'complete' ? 'Redo' :
    'Start →';

  const buttonStyle = status === 'available'
    ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
    : 'bg-slate-700 hover:bg-slate-600 text-slate-300';

  return (
    <div className={`bg-slate-800 border-2 rounded-xl p-4 transition-colors ${borderColor}`}>
      <div className="flex items-start gap-3">
        {/* Lesson number circle */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold mt-0.5 ${
          isLocked ? 'bg-slate-700 text-slate-500' :
          status === 'mastered' ? 'bg-green-500/20 text-green-400' :
          status === 'complete' ? 'bg-cyan-500/20 text-cyan-400' :
          'bg-cyan-500/20 text-cyan-400'
        }`}>
          {isLocked ? '🔒' : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-100">
              {isFirst && index === 0 ? 'Lesson 1 — Introduction' : `Lesson ${index + 1}`}
            </span>
            <span className="text-xs text-slate-500">{cards.length} words</span>
            {statusBadge}
          </div>
          <p className="text-slate-500 text-xs mt-1 truncate">{preview}</p>
        </div>

        {!isLocked && (
          <button
            onClick={() => navigate(`/app/units/${unitId}/lesson/${index}`)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${buttonStyle}`}
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UnitDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [cards, setCards] = useState<CardWithState[]>([]);
  const [unitStatus, setUnitStatus] = useState<UnitProgress['status']>('locked');
  const [prereqName, setPrereqName] = useState<string | null>(null);
  const [displayNum, setDisplayNum] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [allUnits, allProgress] = await Promise.all([getUnits(), getAllUnitProgress()]);
      const progressMap = new Map(allProgress.map(p => [p.unit_id, p]));
      const found = allUnits.find(u => u.id === id);
      if (!found) { navigate('/app/units'); return; }

      const visibleUnits = [...allUnits]
        .filter(u => u.id !== 'unit-00-placement')
        .sort((a, b) => a.level !== b.level ? a.level - b.level : a.order_index - b.order_index);
      const numMap = new Map(visibleUnits.map((u, i) => [u.id, i + 1]));
      setDisplayNum(numMap.get(found.id) ?? null);

      setUnit(found);
      setUnitStatus(computeStatus(found, progressMap));

      if (found.prerequisite_ids.length > 0) {
        const missingId = found.prerequisite_ids.find(
          pid => progressMap.get(pid)?.status !== 'completed'
        );
        if (missingId) setPrereqName(allUnits.find(u => u.id === missingId)?.name ?? null);
      }

      setCards(await getUnitCardsWithState(found.id));
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;
  if (!unit) return null;

  const lessons = computeLessons(cards);
  const knownCount = cards.filter(c => c.state.depth_level >= 3).length;
  const mastery = cards.length > 0 ? Math.round((knownCount / cards.length) * 100) : 0;
  const isLocked = unitStatus === 'locked';

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-800">
        <button
          onClick={() => navigate('/app/units')}
          className="text-slate-400 hover:text-slate-100 transition-colors text-lg"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          {displayNum !== null && <p className="text-xs text-slate-500">Unit {displayNum}</p>}
          <h1 className="font-bold text-slate-100 truncate">{unit.name}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-6">
        {/* Description + meta */}
        <div>
          <p className="text-slate-300 text-sm leading-relaxed">{unit.description}</p>
          <div className="flex gap-3 mt-2 text-xs text-slate-500">
            <span>{lessons.length} lesson{lessons.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{cards.length} words</span>
            <span>·</span>
            <span>~{unit.estimated_hours}h total</span>
          </div>
        </div>

        {/* Overall mastery bar — shown once started */}
        {unitStatus !== 'available' && unitStatus !== 'locked' && cards.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Unit progress</span>
              <span className={mastery >= 70 ? 'text-green-400 font-semibold' : 'text-slate-300'}>
                {knownCount}/{cards.length} mastered
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${mastery >= 70 ? 'bg-green-400' : 'bg-cyan-400'}`}
                style={{ width: `${mastery}%` }}
              />
            </div>
          </div>
        )}

        {/* Grammar notes */}
        {unit.grammar_notes && !isLocked && (
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Grammar
            </h2>
            <div className="bg-slate-800 rounded-xl p-4">
              <GrammarNotes notes={unit.grammar_notes} variant="detail" />
            </div>
          </div>
        )}

        {/* Lesson list */}
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            {isLocked ? 'Lessons' : `${lessons.length} Lesson${lessons.length !== 1 ? 's' : ''}`}
          </h2>

          {isLocked ? (
            <div className="bg-slate-800 rounded-xl p-5 text-center space-y-2">
              <p className="text-2xl">🔒</p>
              <p className="text-slate-300 text-sm">
                Complete{prereqName ? ` "${prereqName}"` : ' the previous unit'} to unlock this unit.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {lessons.map(lesson => (
                <LessonRow
                  key={lesson.index}
                  lesson={lesson}
                  unitId={unit.id}
                  isFirst={lessons.length > 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
