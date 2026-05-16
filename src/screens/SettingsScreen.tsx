import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfileSettings, closeDatabase } from '../database/db';
import type { ProfileSettings } from '../types';

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
    if (!isNaN(n)) {
      onChange(Math.min(max, Math.max(min, n)));
    } else {
      setRaw(String(value));
    }
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <label className="block text-slate-300 text-sm font-medium mb-1">{label}</label>
      <p className="text-slate-500 text-xs mb-3">{hint}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-lg flex items-center justify-center transition-colors"
        >−</button>
        <input
          type="number"
          min={min}
          max={max}
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && commit()}
          className="w-20 text-center bg-slate-700 text-slate-100 font-bold text-lg rounded-lg py-2 border border-slate-600 focus:outline-none focus:border-cyan-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-lg flex items-center justify-center transition-colors"
        >+</button>
        <span className="text-slate-500 text-sm">/ day</span>
      </div>
    </div>
  );
}

export default function SettingsScreen() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ProfileSettings>({ new_words_per_day: 10, reviews_per_day: 20 });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile().then(p => {
      if (p) setSettings(p.settings);
      setLoading(false);
    });
  }, []);

  async function save() {
    await updateProfileSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function switchUser() {
    await closeDatabase();
    navigate('/');
  }

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 pt-2">Settings</h1>

      <NumberInput
        label="New words per day"
        hint="How many new words to introduce during Learn sessions."
        value={settings.new_words_per_day}
        min={1}
        max={50}
        onChange={n => setSettings(s => ({ ...s, new_words_per_day: n }))}
      />

      <NumberInput
        label="Reviews per day"
        hint="Your daily review goal. You'll get a notification when you hit it."
        value={settings.reviews_per_day}
        min={1}
        max={500}
        onChange={n => setSettings(s => ({ ...s, reviews_per_day: n }))}
      />

      <button
        onClick={save}
        className={`w-full py-3 font-bold rounded-xl transition-colors ${
          saved ? 'bg-green-500 text-slate-950' : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
        }`}
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>

      <div className="bg-slate-800 rounded-xl divide-y divide-slate-700">
        <button onClick={switchUser} className="w-full p-4 text-left text-slate-300 hover:text-slate-100 flex items-center gap-3">
          <span className="text-xl">👤</span>
          <span>Switch User</span>
        </button>
      </div>
    </div>
  );
}
