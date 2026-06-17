import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Card, CardRegister } from '../types';
import type { ReviewFilter, ReviewIssueType, ReviewNote } from '../database/db';
import {
  exportReviewNotes,
  getCurrentLanguage,
  getReviewCard,
  getReviewNotesForCard,
  getReviewQueue,
  getReviewStats,
  saveReviewedCard,
  saveReviewNote,
} from '../database/db';
import { getLanguageAdapter } from '../languages';
import { downloadJson } from '../platform/fileExport';

const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: 'generated',   label: 'Needs Review' },
  { id: 'all',         label: 'All Reviewable' },
  { id: 'vocabulary',  label: 'Vocabulary' },
  { id: 'phrase',      label: 'Phrases' },
  { id: 'grammar',     label: 'Grammar' },
  { id: 'conjugation', label: 'Conjugations' },
];

const REGISTER_OPTIONS = ['neutral', 'formal', 'informal', 'slang', 'literary', 'mixed'];
const ISSUE_TYPES: { id: ReviewIssueType; label: string }[] = [
  { id: 'translation', label: 'Translation' },
  { id: 'pronunciation', label: 'Pronunciation' },
  { id: 'cultural_note', label: 'Cultural note' },
  { id: 'register', label: 'Register' },
  { id: 'example', label: 'Example' },
  { id: 'grammar', label: 'Grammar' },
  { id: 'other', label: 'Other' },
];

export default function ReviewScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cardId = searchParams.get('card');
  const [filter, setFilter] = useState<ReviewFilter>('generated');
  const [queue, setQueue] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState({ reviewed: 0, generated: 0 });
  const [edit, setEdit] = useState({ english: '', pronunciation: '', register: 'neutral', cultural_note: '' });
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [noteDraft, setNoteDraft] = useState({
    issue_type: 'translation' as ReviewIssueType,
    note: '',
    suggested_correction: '',
    reviewer: localStorage.getItem('curriculum_reviewer') ?? '',
  });
  const [saved, setSaved] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const language = getLanguageAdapter(getCurrentLanguage());

  useEffect(() => {
    const loadQueue = cardId
      ? getReviewCard(cardId).then(card => (card ? [card] : []))
      : getReviewQueue(filter);
    loadQueue.then(q => {
      setQueue(q);
      setIndex(0);
    });
    getReviewStats().then(setStats);
  }, [filter, cardId]);

  const card: Card | undefined = queue[index];

  useEffect(() => {
    if (!card) return;
    setEdit({
      english: card.english,
      pronunciation: card.pronunciation,
      register: card.register ?? 'neutral',
      cultural_note: card.cultural_note ?? '',
    });
    setNoteDraft(s => ({ ...s, issue_type: 'translation', note: '', suggested_correction: '' }));
    getReviewNotesForCard(card.id).then(setNotes);
    setSaved(false);
    setNoteSaved(false);
  }, [card?.id]);

  function advance() {
    setIndex(i => Math.min(i + 1, queue.length - 1));
  }

  async function saveCurrentNote(): Promise<boolean> {
    if (!card) return false;
    if (!noteDraft.note.trim() && !noteDraft.suggested_correction.trim()) return false;
    localStorage.setItem('curriculum_reviewer', noteDraft.reviewer);
    const note = await saveReviewNote({
      card_id: card.id,
      language: language.id,
      issue_type: noteDraft.issue_type,
      note: noteDraft.note,
      suggested_correction: noteDraft.suggested_correction,
      reviewer: noteDraft.reviewer,
    });
    if (!note.note && !note.suggested_correction) return false;
    setNotes(existing => [note, ...existing]);
    setNoteDraft(s => ({ ...s, note: '', suggested_correction: '' }));
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1200);
    return true;
  }

  async function handleSaveNote() {
    await saveCurrentNote();
  }

  async function handleSave() {
    if (!card) return;
    await saveCurrentNote();
    await saveReviewedCard(card.id, edit);
    setSaved(true);
    setStats(s => ({
      reviewed: card.source === 'generated' ? s.reviewed + 1 : s.reviewed,
      generated: card.source === 'generated' ? s.generated - 1 : s.generated,
    }));
    setQueue(q => q.map(c => c.id === card.id
      ? { ...c, ...edit, register: edit.register as CardRegister, source: 'reviewed' as const }
      : c,
    ));
    setTimeout(() => advance(), 600);
  }

  async function downloadReviewNotes() {
    const rows = await exportReviewNotes();
    downloadJson(`${language.id}_curriculum_review_notes.json`, {
      exported_at: new Date().toISOString(),
      language: language.id,
      notes: rows,
    });
  }

  function downloadCorrectionPatch() {
    if (!card) return;
    const patch = {
      language: language.id,
      card_id: card.id,
      unit_id: card.unit_id,
      type: card.type,
      original: {
        target: card.swahili,
        english: card.english,
        pronunciation: card.pronunciation,
        register: card.register ?? 'neutral',
        cultural_note: card.cultural_note ?? '',
      },
      proposed: {
        target: card.swahili,
        english: edit.english,
        pronunciation: edit.pronunciation,
        register: edit.register,
        cultural_note: edit.cultural_note,
      },
    };
    downloadJson(`${language.id}_${card.id}_correction.json`, patch);
  }

  if (!card) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
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
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
          Back
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-100">Card Review</h1>
          <div className="text-xs text-slate-500 mt-0.5">
            {language.config.name}: {stats.reviewed} reviewed / {stats.generated} generated
          </div>
        </div>
        <button
          onClick={downloadReviewNotes}
          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
        >
          Export Notes
        </button>
      </div>

      {cardId ? (
        <div className="inline-flex w-fit rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-cyan-300">
          Reviewing selected card
        </div>
      ) : (
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
      )}

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

      <div className="flex items-center justify-between">
        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
          card.source === 'reviewed'
            ? 'bg-green-900/50 text-green-300 border-green-700'
            : 'bg-slate-700 text-slate-400 border-slate-600'
        }`}>
          {card.source === 'reviewed' ? 'reviewed' : 'generated'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setIndex(i => Math.max(0, i - 1))}
            disabled={index === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm disabled:opacity-30 transition-colors"
          >
            Prev
          </button>
          <button
            onClick={advance}
            disabled={index >= queue.length - 1}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm disabled:opacity-30 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 space-y-5">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{language.targetShortName}</div>
          <div className="text-3xl font-bold text-slate-100">{card.swahili}</div>
          <div className="text-xs text-slate-500 mt-1">
            {card.type} / {card.unit_id}
            {card.noun_class && ` / class ${card.noun_class}`}
            {card.conjugation_key && ` / ${card.conjugation_key}`}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">English</label>
          <input
            type="text"
            value={edit.english}
            onChange={e => setEdit(s => ({ ...s, english: e.target.value }))}
            className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-base transition-colors outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Pronunciation</label>
          <input
            type="text"
            value={edit.pronunciation}
            onChange={e => setEdit(s => ({ ...s, pronunciation: e.target.value }))}
            placeholder="pronunciation guide"
            className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-sm font-mono transition-colors outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Register</label>
          <select
            value={edit.register}
            onChange={e => setEdit(s => ({ ...s, register: e.target.value }))}
            className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-sm transition-colors outline-none"
          >
            {REGISTER_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Cultural note</label>
          <textarea
            value={edit.cultural_note}
            onChange={e => setEdit(s => ({ ...s, cultural_note: e.target.value }))}
            placeholder="Usage context, pragmatic notes, social meaning..."
            rows={3}
            className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-sm resize-none transition-colors outline-none"
          />
        </div>

        {card.example_sentences[0] && (
          <div className="border-t border-slate-700 pt-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Example</div>
            <div className="text-sm text-slate-300 italic">"{card.example_sentences[0].swahili}"</div>
            <div className="text-sm text-slate-500 mt-0.5">"{card.example_sentences[0].english}"</div>
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100">Review note</h2>
          <p className="text-xs text-slate-500 mt-0.5">Use this for audit comments that should make it back to the seed database review process.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider">Issue type</label>
            <select
              value={noteDraft.issue_type}
              onChange={e => setNoteDraft(s => ({ ...s, issue_type: e.target.value as ReviewIssueType }))}
              className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-sm transition-colors outline-none"
            >
              {ISSUE_TYPES.map(issue => <option key={issue.id} value={issue.id}>{issue.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider">Reviewer</label>
            <input
              type="text"
              value={noteDraft.reviewer}
              onChange={e => setNoteDraft(s => ({ ...s, reviewer: e.target.value }))}
              placeholder="name or initials"
              className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-sm transition-colors outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Note</label>
          <textarea
            value={noteDraft.note}
            onChange={e => setNoteDraft(s => ({ ...s, note: e.target.value }))}
            placeholder="What should be checked, corrected, or discussed?"
            rows={3}
            className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-sm resize-none transition-colors outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Suggested correction</label>
          <textarea
            value={noteDraft.suggested_correction}
            onChange={e => setNoteDraft(s => ({ ...s, suggested_correction: e.target.value }))}
            placeholder="Optional wording, cultural note, pronunciation fix, or grammar correction."
            rows={2}
            className="mt-1 w-full px-4 py-2.5 bg-slate-700 border border-slate-600 focus:border-cyan-400 rounded-lg text-slate-100 text-sm resize-none transition-colors outline-none"
          />
        </div>

        <button
          onClick={handleSaveNote}
          disabled={!noteDraft.note.trim() && !noteDraft.suggested_correction.trim()}
          className="w-full py-3 rounded-xl font-semibold text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 transition-colors"
        >
          {noteSaved ? 'Note Saved' : 'Save Review Note'}
        </button>

        {notes.length > 0 && (
          <div className="border-t border-slate-700 pt-4 space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Existing notes</div>
            {notes.slice(0, 4).map(note => (
              <div key={note.id} className="rounded-lg bg-slate-900/50 border border-slate-700 p-3 text-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                  <span>{note.issue_type} / {note.reviewer || 'unknown reviewer'}</span>
                  <span>{new Date(note.created_at).toLocaleDateString()}</span>
                </div>
                {note.note && <p className="text-slate-300">{note.note}</p>}
                {note.suggested_correction && <p className="text-cyan-300 mt-1">Suggestion: {note.suggested_correction}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={downloadCorrectionPatch}
        className="w-full py-3 rounded-xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
      >
        Export Correction Patch
      </button>
      <button
        onClick={handleSave}
        disabled={saved}
        className={`w-full py-4 rounded-xl font-bold text-base transition-colors ${
          saved
            ? 'bg-green-600 text-white opacity-70'
            : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
        }`}
      >
        {saved ? 'Saved' : 'Save & Mark Reviewed'}
      </button>
    </div>
  );
}
