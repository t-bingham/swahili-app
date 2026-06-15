import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Card, CardRegister } from '../types';
import type { ReviewFilter } from '../database/db';
import { getReviewQueue, saveReviewedCard, getReviewStats } from '../database/db';

const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: 'quick_learn', label: 'Quick Learn' },
  { id: 'unit-01',     label: 'Unit 01 — Greetings' },
  { id: 'unit-05',     label: 'Unit 05 — Food & Drink' },
  { id: 'all',         label: 'All Vocabulary' },
];

const REGISTER_OPTIONS = ['neutral', 'formal', 'informal', 'slang', 'literary', 'mixed'];

export default function ReviewScreen() {
  const navigate = useNavigate();
  const [filter, setFilter]   = useState<ReviewFilter>('quick_learn');
  const [queue, setQueue]     = useState<Card[]>([]);
  const [index, setIndex]     = useState(0);
  const [stats, setStats]     = useState({ reviewed: 0, generated: 0 });
  const [edit, setEdit]       = useState({ english: '', pronunciation: '', register: 'neutral', cultural_note: '' });
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    getReviewQueue(filter).then(q => {
      setQueue(q);
      setIndex(0);
    });
    getReviewStats().then(setStats);
  }, [filter]);

  const card: Card | undefined = queue[index];

  useEffect(() => {
    if (!card) return;
    setEdit({
      english:      card.english,
      pronunciation: card.pronunciation,
      register:     card.register ?? 'neutral',
      cultural_note: card.cultural_note ?? '',
    });
    setSaved(false);
  }, [card?.id]);

  function handleSave() {
    if (!card) return;
    saveReviewedCard(card.id, edit);
    setSaved(true);
    setStats(s => ({
      reviewed:  card.source === 'generated' ? s.reviewed + 1 : s.reviewed,
      generated: card.source === 'generated' ? s.generated - 1 : s.generated,
    }));
    setQueue(q => q.map(c => c.id === card.id
      ? { ...c, ...edit, register: edit.register as CardRegister, source: 'reviewed' as const }
      : c
    ));
    setTimeout(() => advance(), 600);
  }

  function advance() {
    setIndex(i => Math.min(i + 1, queue.length - 1));
  }

  if (!card) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✓</div>
        <div className="text-slate-300 text-lg font-semibold mb-2">Queue empty</div>
        <div className="text-slate-500 text-sm mb-8">No cards to review in this filter.</div>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium transition-colors">
          Back
        </button>
      </div>
    );
  }

  const totalInFilter = queue.length;
  const reviewedInFilter = queue.filter(c => c.source === 'reviewed').length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
          ←
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-100">Card Review</h1>
          <div className="text-xs text-slate-500 mt-0.5">
            {stats.reviewed} reviewed · {stats.generated} still generated (overall)
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Card {index + 1} / {totalInFilter}</span>
          <span>{reviewedInFilter} reviewed in this queue</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all"
            style={{ width: `${(reviewedInFilter / Math.max(totalInFilter, 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Card source badge + navigation */}
      <div className="flex items-center justify-between">
        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
          card.source === 'reviewed'
            ? 'bg-green-900/50 text-green-300 border-green-700'
            : 'bg-slate-700 text-slate-400 border-slate-600'
        }`}>
          {card.source === 'reviewed' ? '✓ reviewed' : 'generated'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setIndex(i => Math.max(0, i - 1))}
            disabled={index === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm disabled:opacity-30 transition-colors"
          >
            ← Prev
          </button>
          <button
            onClick={advance}
            disabled={index >= queue.length - 1}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm disabled:opacity-30 transition-colors"
          >
            Skip →
          </button>
        </div>
      </div>

      {/* Card panel */}
      <div className="bg-slate-800 rounded-2xl p-6 space-y-5">

        {/* Swahili (read-only) */}
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Swahili</div>
          <div className="text-3xl font-bold text-slate-100">{card.swahili}</div>
          <div className="text-xs text-slate-500 mt-1">
            {card.type} · {card.unit_id}
            {card.noun_class && ` · class ${card.noun_class}`}
          </div>
        </div>

        {/* English (editable) */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">English</label>
          <input
            type="text"
            value={edit.english}
            onChange={e => setEdit(s => ({ ...s, english: e.target.value }))}
            className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-base transition-colors outline-none"
          />
        </div>

        {/* Pronunciation (editable) */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Pronunciation</label>
          <input
            type="text"
            value={edit.pronunciation}
            onChange={e => setEdit(s => ({ ...s, pronunciation: e.target.value }))}
            placeholder="e.g. ha-BA-ri"
            className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-sm font-mono transition-colors outline-none"
          />
          <div className="text-xs text-slate-400 mt-1">Capitalise stressed syllable: ha-BA-ri</div>
        </div>

        {/* Register (editable) */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Register</label>
          <select
            value={edit.register}
            onChange={e => setEdit(s => ({ ...s, register: e.target.value }))}
            className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-sm transition-colors outline-none"
          >
            {REGISTER_OPTIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Cultural note (editable) */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Cultural note</label>
          <textarea
            value={edit.cultural_note}
            onChange={e => setEdit(s => ({ ...s, cultural_note: e.target.value }))}
            placeholder="Usage context, pragmatic notes, social meaning…"
            rows={3}
            className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-sm resize-none transition-colors outline-none"
          />
        </div>

        {/* Example sentences (read-only reference) */}
        {card.example_sentences[0] && (
          <div className="border-t border-slate-700 pt-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Example (read-only reference)</div>
            <div className="text-sm text-slate-300 italic">"{card.example_sentences[0].swahili}"</div>
            <div className="text-sm text-slate-500 mt-0.5">"{card.example_sentences[0].english}"</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <button
        onClick={handleSave}
        disabled={saved}
        className={`w-full py-4 rounded-xl font-bold text-base transition-colors ${
          saved
            ? 'bg-green-600 text-white opacity-70'
            : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
        }`}
      >
        {saved ? '✓ Saved' : 'Save & Mark Reviewed'}
      </button>
    </div>
  );
}
