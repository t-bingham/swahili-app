import { useState, useEffect, useCallback, useRef } from 'react';
import { getUnits, searchGalleryCards, getVerbConjugations, setCardStarred, getCurrentLanguage } from '../database/db';
import { printFlashcards } from '../utils/printFlashcards';
import { getLanguageAdapter, type LanguageAdapter } from '../languages';
import type { CardWithState, Unit } from '../types';

// ─── Type filter tabs ─────────────────────────────────────────────────────────

const TYPE_TABS: { value: string; label: string }[] = [
  { value: '',            label: 'All' },
  { value: 'vocabulary',  label: 'Words' },
  { value: 'phrase',      label: 'Phrases' },
  { value: 'grammar',     label: 'Grammar' },
  { value: 'conjugation', label: 'Conjugations' },
];

// ─── Register badge ───────────────────────────────────────────────────────────

const REGISTER_COLOURS: Record<string, string> = {
  formal:   'bg-blue-500/20 text-blue-400',
  informal: 'bg-orange-500/20 text-orange-400',
  slang:    'bg-pink-500/20 text-pink-400',
  literary: 'bg-purple-500/20 text-purple-400',
  mixed:    'bg-slate-500/20 text-slate-400',
  neutral:  '',
};

function RegisterBadge({ register }: { register?: string }) {
  if (!register || register === 'neutral') return null;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${REGISTER_COLOURS[register] ?? 'bg-slate-700 text-slate-400'}`}>
      {register}
    </span>
  );
}

function DepthBadge({ depth }: { depth: number }) {
  if (depth <= 1) return <span className="text-slate-400 text-xs">new</span>;
  if (depth < 3)  return <span className="text-cyan-600 text-xs">learning</span>;
  if (depth < 5)  return <span className="text-green-600 text-xs">known</span>;
  return <span className="text-emerald-400 text-xs">mastered</span>;
}

// ─── Verb conjugation table ───────────────────────────────────────────────────

const TENSE_LABELS: Record<string, string> = {
  na: 'Present (–na–)',
  li: 'Past (–li–)',
  ta: 'Future (–ta–)',
  me: 'Perfect (–me–)',
  ki: 'Conditional (–ki–)',
  ka: 'Sequential (–ka–)',
  ja: 'Not-yet (–ja–)',
  si: 'Negative',
};

const SUBJECT_ORDER = ['ni', 'u', 'a', 'tu', 'm', 'wa'];
const SUBJECT_GLOSS: Record<string, string> = {
  ni: '1SG (I)',   u: '2SG (you)',  a: '3SG (he/she/it)',
  tu: '1PL (we)',  m: '2PL (you all)', wa: '3PL (they)',
};

function parseTenseSubject(conjugationKey?: string): { tense: string; subject: string } | null {
  if (!conjugationKey) return null;
  // Expected formats: "PRES.1SG" or "na.ni" or "present-ni" etc.
  // Try to extract tense marker and subject prefix heuristically
  const parts = conjugationKey.split(/[\.\-_]/);
  if (parts.length >= 2) return { tense: parts[0].toLowerCase(), subject: parts[1].toLowerCase() };
  return null;
}

function groupConjugations(cards: CardWithState[]): Map<string, Map<string, CardWithState>> {
  const grouped = new Map<string, Map<string, CardWithState>>();
  for (const c of cards) {
    const parsed = parseTenseSubject(c.conjugation_key);
    // Fall back: try to extract tense from the swahili form itself
    let tense = parsed?.tense ?? 'other';
    let subject = parsed?.subject ?? '?';

    // Heuristic: check for known tense markers in swahili form
    if (tense === 'other' || !(tense in TENSE_LABELS)) {
      for (const t of Object.keys(TENSE_LABELS)) {
        if (c.swahili.includes(`-${t}-`) || c.swahili.match(new RegExp(`[aiuoe]${t}[aeiou]`))) {
          tense = t; break;
        }
      }
    }

    if (!grouped.has(tense)) grouped.set(tense, new Map());
    grouped.get(tense)!.set(subject, c);
  }
  return grouped;
}

function VerbConjugationTable({ verbRoot, onClose }: { verbRoot: string; onClose: () => void }) {
  const [conjCards, setConjCards] = useState<CardWithState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVerbConjugations(verbRoot).then(cards => {
      setConjCards(cards);
      setLoading(false);
    });
  }, [verbRoot]);

  if (loading) return <div className="p-4 text-slate-500 text-sm">Loading conjugations…</div>;
  if (!conjCards.length) return (
    <div className="p-4 text-slate-500 text-sm text-center">
      No conjugation cards found for this verb.
    </div>
  );

  const grouped = groupConjugations(conjCards);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs uppercase tracking-widest">Conjugations of –{verbRoot}–</p>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-400 text-xs">Hide</button>
      </div>
      {Array.from(grouped.entries()).map(([tense, subjectMap]) => (
        <div key={tense} className="bg-slate-900 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-slate-800/80 text-slate-400 text-xs font-semibold">
            {TENSE_LABELS[tense] ?? tense}
          </div>
          <table className="w-full text-sm">
            <tbody>
              {SUBJECT_ORDER.filter(s => subjectMap.has(s)).map(s => {
                const c = subjectMap.get(s)!;
                return (
                  <tr key={s} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-500 text-xs w-24">{SUBJECT_GLOSS[s] ?? s}</td>
                    <td className="px-3 py-2 text-slate-100 font-medium">{c.swahili}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{c.english}</td>
                    <td className="px-3 py-2 text-right">
                      <DepthBadge depth={c.state.depth_level} />
                    </td>
                  </tr>
                );
              })}
              {/* Any subjects not in SUBJECT_ORDER */}
              {Array.from(subjectMap.entries())
                .filter(([s]) => !SUBJECT_ORDER.includes(s))
                .map(([s, c]) => (
                  <tr key={s} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-500 text-xs w-24">{s}</td>
                    <td className="px-3 py-2 text-slate-100 font-medium">{c.swahili}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{c.english}</td>
                    <td className="px-3 py-2 text-right"><DepthBadge depth={c.state.depth_level} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-slate-700 text-xs text-center">{conjCards.length} conjugation cards total</p>
    </div>
  );
}

// ─── Card detail panel ────────────────────────────────────────────────────────

function CardDetail({ card, onClose, onToggleStar }: {
  card: CardWithState;
  onClose: () => void;
  onToggleStar: (id: string, starred: boolean) => void;
}) {
  const [showConjugations, setShowConjugations] = useState(false);
  const starred = card.state.starred ?? false;
  const dialogRef = useRef<HTMLDivElement>(null);

  // Modal focus management: focus into the dialog on open, restore on close,
  // and trap Tab within it (WCAG 2.4.3 / 2.1.2).
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter(el => !el.hasAttribute('disabled'));
    focusables()[0]?.focus();
    return () => prev?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key !== 'Tab') return;
    const f = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter(el => !el.hasAttribute('disabled'));
    if (f.length === 0) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function toggleStar() {
    onToggleStar(card.id, !starred);
  }

  const isVerb = card.type === 'vocabulary' && card.verb_root;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${card.swahili} — ${card.english}`}
      onKeyDown={onKeyDown}
      className="fixed inset-0 bg-slate-950/90 z-50 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">← Back</button>
        <button onClick={toggleStar} aria-label={starred ? 'Remove from starred words' : 'Add to starred words'} className={`text-xl ${starred ? 'text-yellow-400' : 'text-slate-700'}`}>
          {starred ? '★' : '☆'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Main card */}
        <div className="bg-slate-800 rounded-2xl p-6 text-center space-y-2">
          <div className="flex justify-center gap-2 flex-wrap mb-3">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              card.type === 'vocabulary'  ? 'bg-cyan-500/20 text-cyan-400' :
              card.type === 'phrase'      ? 'bg-green-500/20 text-green-400' :
              card.type === 'grammar'     ? 'bg-purple-500/20 text-purple-400' :
              'bg-orange-500/20 text-orange-400'
            }`}>{card.type}</span>
            <RegisterBadge register={card.register} />
            {card.part_of_speech && (
              <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">{card.part_of_speech}</span>
            )}
          </div>
          <div className="text-4xl font-bold text-slate-100">{card.swahili}</div>
          {card.pronunciation && (
            <div className="text-slate-500 text-sm italic">[{card.pronunciation}]</div>
          )}
          <div className="text-xl text-cyan-400 font-semibold mt-2">{card.english}</div>
          {card.noun_class && (
            <div className="text-slate-500 text-xs">Noun class: {card.noun_class}</div>
          )}
        </div>

        {/* Senses */}
        {card.senses && card.senses.length > 1 && (
          <div className="bg-slate-800/60 rounded-xl p-4">
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-3">Meanings</p>
            <div className="space-y-2">
              {card.senses.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-slate-600 text-xs mt-0.5">{i + 1}.</span>
                  <div>
                    <span className="text-slate-200 text-sm">{s.english}</span>
                    {s.pos && <span className="text-slate-500 text-xs ml-2">({s.pos})</span>}
                    {s.register && s.register !== 'neutral' && (
                      <span className="text-slate-500 text-xs ml-2">[{s.register}]</span>
                    )}
                    {s.note && <p className="text-slate-500 text-xs mt-0.5">{s.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Example sentences */}
        {card.example_sentences.length > 0 && (
          <div className="space-y-2">
            <p className="text-slate-500 text-xs uppercase tracking-widest">Examples</p>
            {card.example_sentences.map((ex, i) => (
              <div key={i} className="bg-slate-800/60 rounded-xl p-4 space-y-1">
                <p className="text-slate-200 text-sm">{ex.swahili}</p>
                <p className="text-slate-500 text-xs italic">{ex.english}</p>
              </div>
            ))}
          </div>
        )}

        {/* Cultural note */}
        {card.cultural_note && (
          <div className="bg-slate-800/60 rounded-xl p-4">
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Cultural note</p>
            <p className="text-slate-300 text-sm">{card.cultural_note}</p>
          </div>
        )}

        {/* Tags */}
        {card.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {card.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-500">{tag}</span>
            ))}
          </div>
        )}

        {/* Etymology */}
        {card.etymology && (
          <p className="text-slate-400 text-xs">Etymology: {card.etymology}</p>
        )}

        {/* Verb conjugation table */}
        {isVerb && (
          <div>
            {!showConjugations ? (
              <button
                onClick={() => setShowConjugations(true)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
              >
                View all conjugations →
              </button>
            ) : (
              <VerbConjugationTable verbRoot={card.verb_root!} onClose={() => setShowConjugations(false)} />
            )}
          </div>
        )}

        {/* SRS status */}
        <div className="bg-slate-800/40 rounded-xl p-4">
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Study status</p>
          <div className="flex items-center gap-4">
            <DepthBadge depth={card.state.depth_level} />
            <span className="text-slate-400 text-xs">
              {card.state.review_count} review{card.state.review_count !== 1 ? 's' : ''}
            </span>
            {card.state.next_review && (
              <span className="text-slate-400 text-xs">
                Due {new Date(card.state.next_review).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card list item ───────────────────────────────────────────────────────────

function CardItem({ card, onClick, onToggleStar }: {
  card: CardWithState;
  onClick: () => void;
  onToggleStar: (id: string, starred: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 rounded-xl px-3 py-3 transition-colors">
      {/* Star is a sibling button (not nested) so both controls are keyboard-reachable */}
      <button
        onClick={() => onToggleStar(card.id, !card.state.starred)}
        className={`text-lg leading-none flex-shrink-0 transition-colors ${
          card.state.starred ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'
        }`}
        aria-label={`${card.state.starred ? 'Unstar' : 'Star'} ${card.swahili}`}
      >
        {card.state.starred ? '★' : '☆'}
      </button>

      <button
        onClick={onClick}
        aria-label={`${card.swahili} — ${card.english}`}
        className="flex-1 flex items-center gap-2 min-w-0 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        <div className="flex-1 min-w-0">
          <div className="text-slate-100 font-semibold">{card.swahili}</div>
          <div className="text-slate-400 text-sm truncate">{card.english}</div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <RegisterBadge register={card.register} />
          <DepthBadge depth={card.state.depth_level} />
          <span className="text-slate-600 text-lg" aria-hidden="true">›</span>
        </div>
      </button>
    </div>
  );
}

// ─── Status filter options ────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: '',         label: 'All' },
  { value: 'new',      label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'known',    label: 'Known' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'starred',  label: '★ Starred' },
];

// ─── CSV export ───────────────────────────────────────────────────────────────

function depthLabel(d: number): string {
  if (d <= 1)   return 'New';
  if (d < 3)    return 'Learning';
  if (d < 5)    return 'Known';
  return 'Mastered';
}

function downloadCSV(cards: CardWithState[], language: LanguageAdapter) {
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const header = [language.targetShortName, 'Pronunciation', 'English', 'Senses', 'Type', 'Register', 'Tags', 'Status', 'Reviews', 'Next Review'];
  const rows = cards.map(c => [
    esc(language.getTargetText(c)),
    esc(c.pronunciation ?? ''),
    esc(language.getEnglishText(c)),
    esc(c.senses ? c.senses.map(s => s.english).join(' / ') : ''),
    esc(c.type),
    esc(c.register ?? 'neutral'),
    esc(c.tags.join(', ')),
    esc(depthLabel(c.state.depth_level)),
    String(c.state.review_count),
    esc(c.state.next_review ? new Date(c.state.next_review).toLocaleDateString() : ''),
  ]);
  const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${language.csvFilenamePrefix()}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CardGalleryScreen() {
  const [typeFilter,   setTypeFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [unitFilter,   setUnitFilter]   = useState('');
  const [search,       setSearch]       = useState('');
  const [units,        setUnits]        = useState<Unit[]>([]);
  const [cards,        setCards]        = useState<CardWithState[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardWithState | null>(null);
  const language = getLanguageAdapter(getCurrentLanguage());

  useEffect(() => {
    getUnits().then(us => setUnits(us.filter(u => u.id !== 'unit-00-placement')));
  }, []);

  const runSearch = useCallback(() => {
    setLoading(true);
    searchGalleryCards(search, typeFilter, unitFilter, statusFilter).then(results => {
      setCards(results);
      setLoading(false);
    });
  }, [search, typeFilter, unitFilter, statusFilter]);

  async function handleToggleStar(cardId: string, newStarred: boolean) {
    await setCardStarred(cardId, newStarred);
    // Update the card in the list so the star reflects immediately
    setCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, state: { ...c.state, starred: newStarred } } : c,
    ));
    // Also update the open detail panel if it's showing the same card
    setSelectedCard(prev =>
      prev?.id === cardId ? { ...prev, state: { ...prev.state, starred: newStarred } } : prev,
    );
  }

  // Debounce so typing doesn't fire a synchronous DB read on every keystroke. (P6.4)
  useEffect(() => {
    const t = setTimeout(runSearch, 250);
    return () => clearTimeout(t);
  }, [runSearch]);

  const filterPillCls = (active: boolean) =>
    `flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      active ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
    }`;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 pb-0">
          <h1 className="text-2xl font-bold text-slate-100 pt-2 mb-4">Word Gallery</h1>

          {/* Search */}
          <div className="relative mb-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={language.searchPlaceholder()}
              aria-label={language.searchAriaLabel()}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 border border-slate-700 focus:outline-none focus:border-cyan-500"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" aria-hidden="true">🔍</span>
          </div>

          {/* Type filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none mb-2">
            {TYPE_TABS.map(t => (
              <button key={t.value} onClick={() => setTypeFilter(t.value)} className={filterPillCls(typeFilter === t.value)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none mb-3">
            {STATUS_TABS.map(t => (
              <button key={t.value} onClick={() => setStatusFilter(t.value)} className={filterPillCls(statusFilter === t.value)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Unit filter + results + export */}
          <div className="flex items-center gap-2 mb-3">
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="flex-1 bg-slate-800 text-slate-300 text-sm rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All units</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Results count + export row */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-xs">
              {loading ? 'Searching…' : `${cards.length} card${cards.length !== 1 ? 's' : ''}${cards.length === 500 ? ' (max)' : ''}`}
            </p>
            {!loading && cards.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => downloadCSV(cards, language)}
                  title="Download CSV"
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                >
                  ↓ CSV
                </button>
                <button
                  onClick={() => printFlashcards(cards, language)}
                  title="Print flashcards"
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                >
                  ⎙ Print
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card list */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
          {cards.map(card => (
            <CardItem key={card.id} card={card} onClick={() => setSelectedCard(card)} onToggleStar={handleToggleStar} />
          ))}
          {!loading && cards.length === 0 && (
            <div className="text-center py-12 text-slate-500">No cards found.</div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedCard && (
        <CardDetail card={selectedCard} onClose={() => setSelectedCard(null)} onToggleStar={handleToggleStar} />
      )}
    </>
  );
}
