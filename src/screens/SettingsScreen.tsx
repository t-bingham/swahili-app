import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfileSettings, closeDatabase, resetCurrentUserData, getCurrentLanguage, getCurrentUser, openDatabase } from '../database/db';
import { applyDisplaySettings } from '../utils/display';
import { getGoogleProfile, clearGoogleSession } from '../auth/googleAuth';
import { uploadToDrive, getLastSyncTime, clearSyncState } from '../sync/driveSync';
import { LANGUAGES } from '../data/languages';
import type { ProfileSettings, LearningGoal, GrammarDepth } from '../types';

function formatRelative(date: Date): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// ─── Reusable primitives ──────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 mb-2 mt-6 first:mt-0">
      {children}
    </p>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-slate-800 rounded-xl divide-y divide-slate-700">{children}</div>;
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between p-4 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-slate-200 text-sm font-medium">{label}</p>
        {hint && <p className="text-slate-500 text-xs mt-0.5">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${value ? 'bg-cyan-500' : 'bg-slate-600'}`}
      >
        <span
          className={`absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

function SegmentedRow<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="p-4">
      <p className="text-slate-200 text-sm font-medium mb-1">{label}</p>
      {hint && <p className="text-slate-500 text-xs mb-3">{hint}</p>}
      <div className="flex gap-1 bg-slate-700/50 rounded-lg p-1">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-colors ${
              value === opt.value
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberInput({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => { setRaw(String(value)); }, [value]);
  function commit() {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    else setRaw(String(value));
  }
  return (
    <div className="p-4">
      <p className="text-slate-200 text-sm font-medium mb-1">{label}</p>
      <p className="text-slate-500 text-xs mb-3">{hint}</p>
      <div className="flex items-center gap-3">
        <button aria-label={`Decrease ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - 1))} className="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-lg flex items-center justify-center transition-colors">−</button>
        <input
          type="number" min={min} max={max} value={raw}
          aria-label={label}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit} onKeyDown={e => e.key === 'Enter' && commit()}
          className="w-20 text-center bg-slate-700 text-slate-100 font-bold text-lg rounded-lg py-2 border border-slate-600 focus:outline-none focus:border-cyan-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button aria-label={`Increase ${label.toLowerCase()}`} onClick={() => onChange(Math.min(max, value + 1))} className="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-lg flex items-center justify-center transition-colors">+</button>
        <span className="text-slate-500 text-sm">/ day</span>
      </div>
    </div>
  );
}

// ─── Goal labels ──────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<LearningGoal, string> = {
  travel_survival:       'Travel',
  live_in_country:       'Living there',
  family_community:      'Family & community',
  business_professional: 'Business',
  academic_literary:     'Academic',
  cultural_curiosity:    'Cultural curiosity',
};

const DEPTH_OPTIONS: { value: GrammarDepth; label: string }[] = [
  { value: 'communication', label: 'Speaking first' },
  { value: 'fluency',       label: 'Balanced' },
  { value: 'linguist',      label: 'Deep dive' },
];

// ─── Main screen ──────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: ProfileSettings = {
  new_words_per_day: 10,
  reviews_per_day: 20,
  new_word_rate: 20,
  grammar_depth: 'fluency',
  exercise_direction: 'balanced',
  show_example_sentences: true,
  gamification_enabled: true,
  pronunciation_style: 'syllable',

};

export default function SettingsScreen() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ProfileSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const googleProfile = getGoogleProfile();
  const lastSync = getLastSyncTime();

  useEffect(() => {
    getProfile().then(p => {
      if (p) setSettings(p.settings);
      setLoading(false);
    });
  }, []);

  function update<K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  async function save() {
    await updateProfileSettings(settings);
    applyDisplaySettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function switchGoogleAccount() {
    await closeDatabase();
    clearGoogleSession();
    clearSyncState();
    navigate('/');
  }

  async function switchLanguage(newLang: string) {
    const user = getCurrentUser();
    if (!user || newLang === getCurrentLanguage()) return;
    await closeDatabase();
    try { await openDatabase(user, newLang); } catch { await openDatabase(user, newLang); }
    sessionStorage.setItem('currentLanguage', newLang);
    // Check whether this user has been onboarded in the new language; if not,
    // route to onboarding to set goal / depth / pace before learning starts.
    const profile = await getProfile();
    navigate(profile ? '/app/home' : '/onboarding');
    // Force a reload so all in-memory state (Zustand store, etc.) is reset.
    setTimeout(() => window.location.reload(), 0);
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMsg('');
    const ok = await uploadToDrive();
    setSyncing(false);
    setSyncMsg(ok ? '✓ Synced to Drive' : navigator.onLine ? 'Sync failed — try again' : 'Offline — will sync after next session');
    if (ok) setTimeout(() => setSyncMsg(''), 3000);
  }

  async function disconnectGoogle() {
    await switchGoogleAccount();
  }

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;

  return (
    <div className="p-4 max-w-lg mx-auto pb-12">
      <h1 className="text-2xl font-bold text-slate-100 pt-2 mb-6">Settings</h1>

      {/* ── Language ── */}
      <SectionHeader>Language</SectionHeader>
      <SettingsCard>
        <div className="p-4">
          <p className="text-slate-200 text-sm font-medium mb-3">Currently learning</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(LANGUAGES).map(l => {
              const active = l.id === getCurrentLanguage();
              return (
                <button
                  key={l.id}
                  onClick={() => switchLanguage(l.id)}
                  aria-pressed={active}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    active ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span aria-hidden="true">{l.flag}</span> {l.name}
                </button>
              );
            })}
          </div>
          <p className="text-slate-500 text-xs mt-3">
            Switching reopens your saved progress for that language. Each language keeps its own
            cards, units, and review history.
          </p>
        </div>
      </SettingsCard>

      {/* ── Learning Path ── */}
      <SectionHeader>Learning Path</SectionHeader>
      <SettingsCard>
        {settings.learning_goal && (
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-slate-200 text-sm font-medium">Your goal</p>
              <p className="text-cyan-400 text-xs mt-0.5">{GOAL_LABELS[settings.learning_goal]}</p>
            </div>
            <button
              onClick={() => navigate('/onboarding')}
              className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
            >
              Change
            </button>
          </div>
        )}
        <SegmentedRow
          label="Grammar depth"
          hint="Controls how many conjugation and grammar cards appear in your sessions."
          value={settings.grammar_depth ?? 'fluency'}
          options={DEPTH_OPTIONS}
          onChange={v => update('grammar_depth', v)}
        />
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-slate-200 text-sm font-medium">Placement test</p>
            <p className="text-slate-500 text-xs mt-0.5">Skip to your level</p>
          </div>
          <button
            onClick={() => navigate('/placement-test')}
            className="py-1.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Re-take
          </button>
        </div>
      </SettingsCard>

      {/* ── Study Style ── */}
      <SectionHeader>Study Style</SectionHeader>
      <SettingsCard>
        <SegmentedRow
          label="Exercise direction"
          hint="Recognition = Swahili → English. Production = English → Swahili."
          value={settings.exercise_direction ?? 'balanced'}
          options={[
            { value: 'recognition', label: 'Recognition' },
            { value: 'balanced',    label: 'Balanced' },
            { value: 'production',  label: 'Production' },
          ]}
          onChange={v => update('exercise_direction', v)}
        />
        <NumberInput
          label="New words per day"
          hint="How many new words to introduce during Learn sessions."
          value={settings.new_words_per_day}
          min={1} max={50}
          onChange={n => update('new_words_per_day', n)}
        />
        <NumberInput
          label="Reviews per day"
          hint="Your daily review goal."
          value={settings.reviews_per_day}
          min={1} max={500}
          onChange={n => update('reviews_per_day', n)}
        />
        <div className="p-4">
          <p className="text-slate-200 text-sm font-medium mb-1">New word rate</p>
          <p className="text-slate-500 text-xs mb-3">
            In Learn mode — how often a new (unseen) word is drawn instead of a review.
            <br />
            <span className="text-slate-400">Slow and steady: 0–20% · Adventure mode: 50%+</span>
          </p>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-xs shrink-0 whitespace-nowrap">Reviews</span>
            <input
              type="range" min={0} max={100} step={5}
              value={settings.new_word_rate}
              aria-label="New word rate"
              aria-valuetext={`${settings.new_word_rate}% new words`}
              onChange={e => update('new_word_rate', Number(e.target.value))}
              className="flex-1 accent-cyan-500"
            />
            <span className="text-slate-400 text-xs shrink-0 whitespace-nowrap">New words</span>
          </div>
          <p className="text-center text-cyan-400 font-bold text-base mt-2">{settings.new_word_rate}%</p>
        </div>
        <ToggleRow
          label="Show example sentences"
          hint="Displayed when an answer is revealed."
          value={settings.show_example_sentences ?? true}
          onChange={v => update('show_example_sentences', v)}
        />
        <ToggleRow
          label="Show pronunciation on reveal"
          hint="Shows the syllable guide (e.g. ki-TA-bu) after you answer — uses the pronunciation style set below."
          value={settings.show_pronunciation_on_reveal ?? false}
          onChange={v => update('show_pronunciation_on_reveal', v)}
        />
        <ToggleRow
          label="Pronunciation audio"
          hint="Adds a 🔊 button on reveal to hear the word aloud. Only works if your device has a Swahili voice installed — otherwise the button stays hidden."
          value={settings.enable_audio ?? false}
          onChange={v => update('enable_audio', v)}
        />
        <ToggleRow
          label="Disable type-answer"
          hint="Skip typed input exercises — useful if you prefer tapping over typing."
          value={settings.disable_type_answer ?? false}
          onChange={v => update('disable_type_answer', v)}
        />
        <ToggleRow
          label="Disable flashcards"
          hint="Skip flashcard exercises — go straight to multiple choice and typing."
          value={settings.disable_flashcard ?? false}
          onChange={v => update('disable_flashcard', v)}
        />
      </SettingsCard>

      {/* ── Display ── */}
      <SectionHeader>Display</SectionHeader>
      <SettingsCard>

        <SegmentedRow
          label="Pronunciation style"
          value={settings.pronunciation_style ?? 'syllable'}
          options={[
            { value: 'syllable', label: 'Syllable' },
            { value: 'ipa',      label: 'IPA' },
            { value: 'none',     label: 'None' },
          ]}
          onChange={v => update('pronunciation_style', v)}
        />
        <ToggleRow
          label="Show morpheme hints"
          hint="For conjugations, show the breakdown after reveal (e.g. ni·na·pend·a)."
          value={settings.show_morpheme_hints ?? false}
          onChange={v => update('show_morpheme_hints', v)}
        />
        <ToggleRow
          label="Large text"
          hint="Increases base font size for easier reading."
          value={settings.large_text ?? false}
          onChange={v => update('large_text', v)}
        />
        <ToggleRow
          label="High contrast"
          hint="Increases text/background contrast to WCAG AAA levels."
          value={settings.high_contrast ?? false}
          onChange={v => update('high_contrast', v)}
        />
      </SettingsCard>

      {/* ── Motivation ── */}
      <SectionHeader>Motivation</SectionHeader>
      <SettingsCard>
        <ToggleRow
          label="Streaks & XP"
          hint="Turn off to replace the XP counter with a quiet 'Words known' display."
          value={settings.gamification_enabled ?? true}
          onChange={v => update('gamification_enabled', v)}
        />
      </SettingsCard>

      {/* ── Save ── */}
      <button
        onClick={save}
        className={`w-full mt-6 py-3 font-bold rounded-xl transition-colors ${
          saved ? 'bg-green-500 text-slate-950' : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
        }`}
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>

      {/* ── Google Drive ── */}
      {googleProfile && (
        <>
          <SectionHeader>Google Drive Sync</SectionHeader>
          <div className="bg-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <img src={googleProfile.picture} alt={googleProfile.name} className="w-9 h-9 rounded-full" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-sm font-medium truncate">{googleProfile.name}</p>
                <p className="text-slate-500 text-xs truncate">
                  {lastSync ? `Last synced ${formatRelative(lastSync)}` : 'Not yet synced'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={syncNow}
                disabled={syncing}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm font-semibold rounded-lg transition-colors"
              >
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button onClick={disconnectGoogle} className="px-4 py-2 text-slate-500 hover:text-red-400 text-sm transition-colors">
                Disconnect
              </button>
            </div>
            {syncMsg && (
              <p className={`text-xs ${syncMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{syncMsg}</p>
            )}
          </div>
        </>
      )}

      {/* ── Developer tools ── */}
      {import.meta.env.DEV && (
        <>
          <SectionHeader>Developer Tools</SectionHeader>
          <SettingsCard>
            <button onClick={() => navigate('/app/review')} className="w-full p-4 text-left text-slate-300 hover:text-slate-100 flex items-center gap-3">
              <span className="text-xl">✏️</span>
              <div>
                <div className="text-sm font-medium">Card Review Pipeline</div>
                <div className="text-xs text-slate-500 mt-0.5">Correct generated card content &amp; mark as reviewed</div>
              </div>
            </button>
            <button
              onClick={async () => {
                if (!confirm('Delete all progress and sign out? This cannot be undone.')) return;
                await resetCurrentUserData();
                clearGoogleSession();
                clearSyncState();
                navigate('/');
              }}
              className="w-full p-4 text-left text-red-400 hover:text-red-300 flex items-center gap-3"
            >
              <span className="text-xl">🗑️</span>
              <div>
                <div className="text-sm font-medium">Reset account data</div>
                <div className="text-xs text-red-400/60 mt-0.5">Wipes local database and signs out</div>
              </div>
            </button>
          </SettingsCard>
        </>
      )}

      {/* ── Account ── */}
      <SectionHeader>Account</SectionHeader>
      <SettingsCard>
        <button onClick={switchGoogleAccount} className="w-full p-4 text-left text-slate-300 hover:text-slate-100 flex items-center gap-3">
          <span className="text-xl">👤</span>
          <span>Switch Google account</span>
        </button>
      </SettingsCard>
    </div>
  );
}
