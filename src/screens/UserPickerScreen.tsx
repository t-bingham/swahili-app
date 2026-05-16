import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { openDatabase, listUsers, getProfile } from '../database/db';

export default function UserPickerScreen() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listUsers().then(setUsers).finally(() => setLoading(false));
  }, []);

  async function selectUser(name: string) {
    setOpening(name);
    try {
      await openDatabase(name);
      sessionStorage.setItem('currentUser', name);
      const profile = await getProfile();
      navigate(profile ? '/app/home' : '/onboarding');
    } catch (e) {
      setError('Failed to open database. Make sure the app is served (not opened as a file).');
      setOpening(null);
    }
  }

  async function createUser() {
    const name = newName.trim();
    if (!name) return;
    if (users.includes(name.toLowerCase())) {
      setError('A user with that name already exists.');
      return;
    }
    setError('');
    await selectUser(name.toLowerCase().replace(/\s+/g, '_'));
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🦁</div>
          <h1 className="text-3xl font-bold text-slate-100">Swahili</h1>
          <p className="text-slate-400 mt-1">Choose your profile</p>
        </div>

        {loading ? (
          <p className="text-slate-400 text-center">Loading…</p>
        ) : (
          <>
            {users.length > 0 && (
              <div className="mb-6 space-y-2">
                {users.map(u => (
                  <button
                    key={u}
                    onClick={() => selectUser(u)}
                    disabled={opening !== null}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-left transition-colors disabled:opacity-50"
                  >
                    <span className="text-2xl">👤</span>
                    <span className="text-slate-100 font-medium capitalize">{u.replace(/_/g, ' ')}</span>
                    {opening === u && <span className="ml-auto text-cyan-400 text-sm">Opening…</span>}
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-slate-800 pt-6">
              <p className="text-slate-400 text-sm mb-3">New profile</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && createUser()}
                  placeholder="Your name"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-400"
                />
                <button
                  onClick={createUser}
                  disabled={!newName.trim() || opening !== null}
                  className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-xl disabled:opacity-40 transition-colors"
                >
                  Start
                </button>
              </div>
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
