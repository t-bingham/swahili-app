import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProfile, getCurrentUser } from '../database/db';
import type { LearningGoal, GrammarDepth, ProfileSettings } from '../types';

// ─── Step definitions ─────────────────────────────────────────────────────────

type Step = 'goal' | 'depth' | 'pace' | 'placement';

const GOALS: { value: LearningGoal; title: string; subtitle: string }[] = [
  { value: 'travel_survival',      title: 'Travel',                 subtitle: 'Getting by on a trip to East Africa' },
  { value: 'live_in_country',      title: 'Living there',           subtitle: 'Moving to Tanzania, Kenya, or another Swahili region' },
  { value: 'family_community',     title: 'Family & community',     subtitle: 'Speaking with family or community members' },
  { value: 'business_professional',title: 'Business',               subtitle: 'Work or formal professional settings' },
  { value: 'academic_literary',    title: 'Academic',               subtitle: 'Reading, writing, or formal study of Swahili' },
  { value: 'cultural_curiosity',   title: 'Cultural curiosity',     subtitle: 'Exploring the culture and history' },
];

const DEPTHS: { value: GrammarDepth; title: string; subtitle: string; detail: string }[] = [
  {
    value: 'communication',
    title: 'Speaking first',
    subtitle: 'Vocabulary and phrases — skip conjugation drills',
    detail: 'Great for travel and everyday conversation. You learn to communicate before worrying about grammar rules.',
  },
  {
    value: 'fluency',
    title: 'Balanced',
    subtitle: 'Vocabulary, phrases, and grammar together',
    detail: 'The recommended path. Grammar is woven into the curriculum so you build both communication skills and understanding.',
  },
  {
    value: 'linguist',
    title: 'Deep dive',
    subtitle: 'Full grammar detail, morpheme breakdowns',
    detail: 'For academic learners or those who love linguistic structure. Every conjugation form, every morpheme explained.',
  },
];

const WORD_OPTIONS = [5, 10, 15, 20, 30];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${i < step ? 'bg-cyan-400' : i === step - 1 ? 'bg-cyan-400' : 'bg-slate-700'}`}
        />
      ))}
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('goal');
  const [goal, setGoal]   = useState<LearningGoal>('academic_literary');
  const [depth, setDepth] = useState<GrammarDepth>('fluency');
  const [newWordsPerDay, setNewWordsPerDay] = useState(10);

  async function finish(wantsPlacementTest: boolean) {
    const user = getCurrentUser() ?? 'default';
    const displayName = user.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const settings: ProfileSettings = {
      new_words_per_day: newWordsPerDay,
      reviews_per_day: 20,
      new_word_rate: 20,
      learning_goal: goal,
      grammar_depth: depth,
      exercise_direction: 'balanced',
      show_example_sentences: true,
      gamification_enabled: true,
      pronunciation_style: 'syllable',
    };

    await createProfile(displayName, settings);

    if (wantsPlacementTest) {
      navigate('/placement-test');
    } else {
      navigate('/app/home');
    }
  }

  // ── Goal step ─────────────────────────────────────────────────────────────

  if (step === 'goal') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col p-6">
        <StepHeader step={1} total={4} />
        <div className="flex-1 flex flex-col justify-center space-y-6 max-w-sm mx-auto w-full">
          <div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Why are you learning Swahili?</h2>
            <p className="text-slate-400 text-sm">This helps us prioritise the right vocabulary for you.</p>
          </div>
          <div className="space-y-2">
            {GOALS.map(g => (
              <button
                key={g.value}
                onClick={() => setGoal(g.value)}
                className={`w-full py-3 px-4 rounded-xl border-2 text-left transition-colors ${
                  goal === g.value
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <span className={`block text-sm font-semibold ${goal === g.value ? 'text-cyan-400' : 'text-slate-200'}`}>
                  {g.title}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">{g.subtitle}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setStep('depth')}
          className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-2xl text-lg transition-colors mt-6"
        >
          Next →
        </button>
      </div>
    );
  }

  // ── Grammar depth step ────────────────────────────────────────────────────

  if (step === 'depth') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col p-6">
        <StepHeader step={2} total={4} />
        <div className="flex-1 flex flex-col justify-center space-y-6 max-w-sm mx-auto w-full">
          <div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">How much grammar?</h2>
            <p className="text-slate-400 text-sm">You can always change this in Settings.</p>
          </div>
          <div className="space-y-3">
            {DEPTHS.map(d => (
              <button
                key={d.value}
                onClick={() => setDepth(d.value)}
                className={`w-full py-4 px-4 rounded-xl border-2 text-left transition-colors ${
                  depth === d.value
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <span className={`block text-sm font-semibold ${depth === d.value ? 'text-cyan-400' : 'text-slate-200'}`}>
                  {d.title}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">{d.subtitle}</span>
                {depth === d.value && (
                  <span className="block text-xs text-slate-400 mt-2 border-t border-slate-700 pt-2">{d.detail}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setStep('goal')}
            className="py-4 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-colors"
          >
            ←
          </button>
          <button
            onClick={() => setStep('pace')}
            className="flex-1 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-2xl text-lg transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  // ── Daily pace step ───────────────────────────────────────────────────────

  if (step === 'pace') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col p-6">
        <StepHeader step={3} total={4} />
        <div className="flex-1 flex flex-col justify-center space-y-6 max-w-sm mx-auto w-full">
          <div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">How many new words per day?</h2>
            <p className="text-slate-400 text-sm">Start slow — you can always increase it. Reviews of existing words happen on top of this.</p>
          </div>
          <div className="space-y-2">
            {WORD_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setNewWordsPerDay(n)}
                className={`w-full py-4 px-5 rounded-xl border-2 text-left transition-colors flex items-center justify-between ${
                  newWordsPerDay === n
                    ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                    : 'border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-lg font-semibold">{n} new words / day</span>
                {newWordsPerDay === n && <span className="text-cyan-400 font-bold">✓</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setStep('depth')}
            className="py-4 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-colors"
          >
            ←
          </button>
          <button
            onClick={() => setStep('placement')}
            className="flex-1 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-2xl text-lg transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  // ── Placement test offer ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-6">
      <StepHeader step={4} total={4} />
      <div className="flex-1 flex flex-col justify-center space-y-6 max-w-sm mx-auto w-full">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Do you already know some Swahili?</h2>
          <p className="text-slate-400 text-sm">A short placement test will skip you past content you already know. It stops as soon as you miss 5 questions — no pressure.</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => finish(true)}
            className="w-full py-4 px-5 rounded-xl border-2 border-cyan-400 bg-cyan-400/10 text-left transition-colors"
          >
            <span className="block text-sm font-semibold text-cyan-400">Take a placement test</span>
            <span className="block text-xs text-slate-400 mt-0.5">~5 minutes · skip to the right level</span>
          </button>

          <button
            onClick={() => finish(false)}
            className="w-full py-4 px-5 rounded-xl border-2 border-slate-700 hover:border-slate-500 text-left transition-colors"
          >
            <span className="block text-sm font-semibold text-slate-200">Start from the beginning</span>
            <span className="block text-xs text-slate-500 mt-0.5">Unit 1 · Greetings & Introductions</span>
          </button>
        </div>

        <p className="text-slate-400 text-xs text-center">
          You'll be learning Standard Swahili (Kiunguja / Zanzibar coastal basis) — the variety used in education and media across East Africa.
        </p>
      </div>
      <button
        onClick={() => setStep('pace')}
        className="mt-6 py-3 text-slate-500 hover:text-slate-300 text-sm transition-colors"
      >
        ← Back
      </button>
    </div>
  );
}
