import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getUnits, getAllUnitProgress, getUnitCardsWithState,
  introduceCards, upsertUnitProgress,
} from '../database/db';
import GrammarNotes from '../components/GrammarNotes';
import { computeLessons } from '../utils/lessons';
import { unitBasePath } from '../utils/unitTracks';
import type { Unit, CardWithState } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function primaryEnglish(card: CardWithState): string {
  if (card.type === 'grammar') return card.english;
  return card.english.split('/')[0].split(',')[0].replace(/\s*\([^)]*\)/g, '').trim();
}

function getOptions(card: CardWithState, pool: CardWithState[]): string[] {
  const correct = primaryEnglish(card);
  const distractors = pool
    .filter(c => c.id !== card.id)
    .map(c => primaryEnglish(c))
    .filter((e, i, arr) => e !== correct && arr.indexOf(e) === i)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  return [...distractors, correct].sort(() => Math.random() - 0.5);
}

// ─── Phase types ──────────────────────────────────────────────────────────────

type LessonPhase = 'grammar' | 'words' | 'practice' | 'results';

interface PracticeResult {
  card: CardWithState;
  correct: boolean;
}

// ─── Info bubble ─────────────────────────────────────────────────────────────

function InfoNote({ note }: { note: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span className="text-sm">ℹ</span>
        <span className="text-sm flex-1 text-slate-400">Grammar explanation</span>
        <span className="text-xs text-slate-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 text-sm text-slate-300 leading-relaxed border-t border-slate-700 whitespace-pre-line">
          {note}
        </div>
      )}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
        <span>{label}</span>
        <span>{current}/{total}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-cyan-400 rounded-full transition-all duration-300"
          style={{ width: `${(current / Math.max(total, 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── Grammar phase ────────────────────────────────────────────────────────────

function GrammarPhase({
  unit,
  lessonIndex,
  totalLessons,
  onContinue,
}: {
  unit: Unit;
  lessonIndex: number;
  totalLessons: number;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col h-full p-5 max-w-lg mx-auto">
      <div className="mb-5">
        <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-1">
          Lesson {lessonIndex + 1} of {totalLessons} · Grammar
        </p>
        <h2 className="text-2xl font-bold text-slate-100">{unit.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        <div className="bg-slate-800 rounded-2xl p-5">
          <GrammarNotes notes={unit.grammar_notes} variant="lesson" />
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-300 text-sm">
            You'll see each word in context — take your time before the practice.
          </p>
        </div>
      </div>

      <button
        onClick={onContinue}
        className="mt-5 w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-lg rounded-2xl transition-colors"
      >
        See the words →
      </button>
    </div>
  );
}

// ─── Words phase ──────────────────────────────────────────────────────────────

function WordsPhase({
  cards,
  wordIndex,
  lessonIndex,
  totalLessons,
  onNext,
}: {
  cards: CardWithState[];
  wordIndex: number;
  lessonIndex: number;
  totalLessons: number;
  onNext: () => void;
}) {
  const card = cards[wordIndex];
  const isLast = wordIndex === cards.length - 1;
  const ex = card.example_sentences?.[0];
  const isNew = card.state.depth_level === 1;

  return (
    <div className="flex flex-col h-full p-5 max-w-lg mx-auto">
      <div className="mb-4 space-y-1">
        <p className="text-xs text-slate-500">
          Lesson {lessonIndex + 1} of {totalLessons}
        </p>
        <ProgressBar current={wordIndex + 1} total={cards.length} label="Words" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex flex-col justify-center gap-4 py-2">
          {/* Word card */}
          <div className="bg-slate-800 rounded-2xl p-8 text-center space-y-3">
            {isNew && (
              <span className="inline-block px-3 py-0.5 bg-cyan-500/15 border border-cyan-500/30 rounded-full text-cyan-400 text-xs font-semibold tracking-wide">
                NEW
              </span>
            )}
            <div className="text-4xl font-bold text-slate-100">{card.swahili}</div>
            {card.pronunciation && (
              <div className="text-slate-500 text-sm italic">[{card.pronunciation}]</div>
            )}
            <div className="pt-2 border-t border-slate-700">
              <div className="text-2xl text-cyan-400 font-semibold">{card.english}</div>
            </div>
          </div>

          {/* Example sentence */}
          {ex && (
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 space-y-1.5">
              <p className="text-slate-500 text-xs uppercase tracking-wide">Example</p>
              <p className="text-slate-200 font-medium">{ex.swahili}</p>
              <p className="text-slate-400 text-sm italic">"{ex.english}"</p>
            </div>
          )}

          {card.type === 'grammar' && card.cultural_note && (
            <InfoNote note={card.cultural_note} />
          )}
        </div>
      </div>

      <button
        onClick={onNext}
        className="mt-5 w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-lg rounded-2xl transition-colors"
      >
        {isLast ? 'Start practice →' : 'Next word →'}
      </button>
    </div>
  );
}

// ─── Practice phase ───────────────────────────────────────────────────────────

function PracticePhase({
  card,
  allLessonCards,
  practiceIndex,
  totalPractice,
  results,
  lessonIndex,
  totalLessons,
  showHint,
  onToggleHint,
  onAnswer,
}: {
  card: CardWithState;
  allLessonCards: CardWithState[];
  practiceIndex: number;
  totalPractice: number;
  results: PracticeResult[];
  lessonIndex: number;
  totalLessons: number;
  showHint: boolean;
  onToggleHint: () => void;
  onAnswer: (correct: boolean) => void;
}) {
  const [options] = useState(() => getOptions(card, allLessonCards));
  const [selected, setSelected] = useState<string | null>(null);
  const correct = primaryEnglish(card);

  function handleSelect(opt: string) {
    if (selected !== null) return;
    setSelected(opt);
    setTimeout(() => onAnswer(opt === correct), 1100);
  }

  const optionStyle = (opt: string) => {
    if (selected === null)
      return 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 active:border-cyan-400';
    if (opt === correct)
      return 'border-green-500 bg-green-500/10 text-green-300';
    if (opt === selected)
      return 'border-red-500 bg-red-500/10 text-red-300';
    return 'border-slate-700 bg-slate-800 text-slate-500';
  };

  return (
    <div className="flex flex-col h-full p-5 max-w-lg mx-auto">
      <div className="mb-4 space-y-1">
        <p className="text-xs text-slate-500">Lesson {lessonIndex + 1} of {totalLessons}</p>
        <ProgressBar current={practiceIndex + 1} total={totalPractice} label="Practice" />
      </div>

      <div className="flex-1 flex flex-col justify-center gap-5">
        <div className="bg-slate-800 rounded-2xl p-8 text-center space-y-2">
          <p className="text-slate-500 text-sm">What does this mean?</p>
          <div className="text-3xl font-bold text-slate-100">{card.swahili}</div>
          {card.pronunciation && (
            <div className="text-slate-500 text-sm italic">[{card.pronunciation}]</div>
          )}
          {card.type === 'grammar' && card.example_sentences?.[0] && (
            <div className="pt-1 space-y-1">
              {showHint && (
                <p className="text-slate-500 text-xs italic">
                  e.g. "{card.example_sentences[0].english}"
                </p>
              )}
              <button
                onClick={onToggleHint}
                className="text-slate-700 hover:text-slate-500 text-xs transition-colors"
              >
                {showHint ? 'hide hint' : 'show hint'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              className={`w-full py-4 px-5 rounded-xl border-2 text-left font-medium transition-colors ${optionStyle(opt)}`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {results.length > 0 && (
        <p className="text-center text-xs text-slate-400 mt-2">
          {results.filter(r => r.correct).length}/{results.length} correct
        </p>
      )}
    </div>
  );
}

// ─── Results phase ────────────────────────────────────────────────────────────

function ResultsPhase({
  results,
  passed,
  unit,
  lessonIndex,
  totalLessons,
  onDone,
  onRetry,
}: {
  results: PracticeResult[];
  passed: boolean;
  unit: Unit;
  lessonIndex: number;
  totalLessons: number;
  onDone: () => void;
  onRetry: () => void;
}) {
  const correct = results.filter(r => r.correct).length;
  const missed = results.filter(r => !r.correct);
  const isLastLesson = lessonIndex === totalLessons - 1;

  if (!passed) {
    return (
      <div className="flex flex-col h-full p-5 max-w-lg mx-auto">
        <div className="flex-1 overflow-y-auto space-y-5">
          <div className="text-center py-4 space-y-2">
            <div className="text-6xl">😅</div>
            <h2 className="text-2xl font-bold text-slate-100">Not quite!</h2>
            <p className="text-slate-400 text-sm">You need to get all words right to complete the lesson.</p>
          </div>

          <div className="bg-slate-800 rounded-2xl p-5 text-center">
            <div className="text-4xl font-bold text-red-400">{correct}/{results.length}</div>
            <div className="text-slate-400 text-sm mt-1">Review the words below and try again.</div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Missed words</p>
            <div className="bg-slate-800 rounded-xl divide-y divide-slate-700/50">
              {missed.map(({ card }) => (
                <div key={card.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <span className="font-medium text-slate-200 text-sm">{card.swahili}</span>
                  <span className="text-slate-400 text-sm text-right">{primaryEnglish(card)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={onRetry}
          className="mt-5 w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-lg rounded-2xl transition-colors"
        >
          Try again →
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-5 max-w-lg mx-auto">
      <div className="flex-1 overflow-y-auto space-y-5">
        <div className="text-center py-4 space-y-2">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-bold text-slate-100">Lesson {lessonIndex + 1} done!</h2>
          <p className="text-slate-400 text-sm">{unit.name}</p>
        </div>

        {results.length > 0 && (
          <div className="bg-slate-800 rounded-2xl p-5 text-center">
            <div className="text-4xl font-bold text-cyan-400">{correct}/{results.length}</div>
            <div className="text-slate-400 text-sm mt-1">Perfect!</div>
          </div>
        )}

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Added to your review queue</p>
          <p className="text-slate-300 text-sm">
            These words will appear in the <strong className="text-slate-100">Learn tab</strong> for spaced repetition.
            {!isLastLesson && ' Lesson ' + (lessonIndex + 2) + ' is now unlocked.'}
          </p>
        </div>
      </div>

      <button
        onClick={onDone}
        className="mt-5 w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-lg rounded-2xl transition-colors"
      >
        {isLastLesson ? 'Finish unit' : 'Back to unit'}
      </button>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function UnitLessonScreen() {
  const { id, lessonIndex: lessonIndexParam } = useParams<{ id: string; lessonIndex: string }>();
  const navigate = useNavigate();

  const lessonIndex = Number(lessonIndexParam ?? 0);

  const [unit, setUnit] = useState<Unit | null>(null);
  const [lessonCards, setLessonCards] = useState<CardWithState[]>([]);
  const [allUnitCards, setAllUnitCards] = useState<CardWithState[]>([]);
  const [totalLessons, setTotalLessons] = useState(1);
  const [practiceCards, setPracticeCards] = useState<CardWithState[]>([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<LessonPhase>('grammar');
  const [wordIndex, setWordIndex] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [passed, setPassed] = useState(false);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    async function load() {
      const allUnits = await getUnits();
      const found = allUnits.find(u => u.id === id);
      if (!found) { navigate('/app/units'); return; }
      const foundBasePath = unitBasePath(found);
      setUnit(found);

      const allCards = await getUnitCardsWithState(found.id);
      setAllUnitCards(allCards);

      const lessons = computeLessons(allCards);
      setTotalLessons(lessons.length);

      const lesson = lessons[lessonIndex];
      if (!lesson) { navigate(`${foundBasePath}/${id}`); return; }

      setLessonCards(lesson.cards);

      // Practice: skip fill-blank grammar, shuffle, cap at lesson size
      const eligible = lesson.cards.filter(c => !(c.type === 'grammar' && c.swahili.includes('___')));
      setPracticeCards([...eligible].sort(() => Math.random() - 0.5));

      // Grammar phase only for lesson 0 (if notes exist)
      setPhase(lessonIndex === 0 && found.grammar_notes?.trim() ? 'grammar' : 'words');
      setLoading(false);
    }
    load();
  }, [id, lessonIndex]);

  const completeLesson = useCallback(async (finalResults: PracticeResult[]) => {
    if (!unit) return;

    const allCorrect = finalResults.length === 0 || finalResults.every(r => r.correct);

    if (allCorrect) {
      await introduceCards(lessonCards.map(c => c.id));

      const prevIntroduced = allUnitCards.filter(c => c.state.depth_level >= 2).length;
      const newlyIntroduced = lessonCards.filter(c => c.state.depth_level === 1).length;
      const mastery = allUnitCards.length > 0
        ? Math.round(((prevIntroduced + newlyIntroduced) / allUnitCards.length) * 100)
        : 0;

      const isLastLesson = lessonIndex === totalLessons - 1;
      const now = new Date().toISOString();
      const allProgress = await getAllUnitProgress();
      const existing = allProgress.find(p => p.unit_id === unit.id);

      await upsertUnitProgress({
        unit_id: unit.id,
        status: isLastLesson ? 'completed' : 'in_progress',
        started_at: existing?.started_at ?? now,
        completed_at: isLastLesson ? now : null,
        mastery_score: mastery,
      });
    }

    setPassed(allCorrect);
    setResults(finalResults);
    setPhase('results');
  }, [unit, lessonCards, allUnitCards, lessonIndex, totalLessons]);

  function handleAnswer(correct: boolean) {
    const updated = [...results, { card: practiceCards[practiceIndex], correct }];
    if (practiceIndex + 1 >= practiceCards.length) {
      completeLesson(updated);
    } else {
      setResults(updated);
      setPracticeIndex(i => i + 1);
    }
  }

  if (loading || !unit) {
    return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;
  }

  const showBackButton = phase === 'grammar' || phase === 'words';
  const basePath = unitBasePath(unit);

  return (
    <div className="flex flex-col h-full">
      {showBackButton && (
        <div className="flex items-center gap-3 px-4 pt-4 pb-1 max-w-lg mx-auto w-full">
          <button
            onClick={() => navigate(`${basePath}/${unit.id}`)}
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            ←
          </button>
          <span className="text-slate-400 text-sm truncate">{unit.name}</span>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {phase === 'grammar' && (
          <GrammarPhase
            unit={unit}
            lessonIndex={lessonIndex}
            totalLessons={totalLessons}
            onContinue={() => setPhase('words')}
          />
        )}

        {phase === 'words' && (
          <WordsPhase
            cards={lessonCards}
            wordIndex={wordIndex}
            lessonIndex={lessonIndex}
            totalLessons={totalLessons}
            onNext={() => {
              if (wordIndex + 1 >= lessonCards.length) {
                practiceCards.length > 0 ? setPhase('practice') : completeLesson([]);
              } else {
                setWordIndex(i => i + 1);
              }
            }}
          />
        )}

        {phase === 'practice' && practiceCards[practiceIndex] && (
          <PracticePhase
            key={practiceIndex}
            card={practiceCards[practiceIndex]}
            allLessonCards={lessonCards}
            practiceIndex={practiceIndex}
            totalPractice={practiceCards.length}
            results={results}
            lessonIndex={lessonIndex}
            totalLessons={totalLessons}
            showHint={showHint}
            onToggleHint={() => setShowHint(h => !h)}
            onAnswer={handleAnswer}
          />
        )}

        {phase === 'results' && (
          <ResultsPhase
            results={results}
            passed={passed}
            unit={unit}
            lessonIndex={lessonIndex}
            totalLessons={totalLessons}
            onDone={() => navigate(`${basePath}/${unit.id}`)}
            onRetry={() => {
              setPracticeCards(prev => [...prev].sort(() => Math.random() - 0.5));
              setPracticeIndex(0);
              setResults([]);
              setPassed(false);
              setPhase('practice');
            }}
          />
        )}
      </div>
    </div>
  );
}
