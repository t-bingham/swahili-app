import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { openDatabase, listUsers, getProfile, importDatabase, warmDatabase } from '../database/db';
import {
  saveGoogleSession, getGoogleProfile, getOrRefreshToken, clearGoogleSession,
  googleUsername, isGoogleSignedIn,
} from '../auth/googleAuth';
import { downloadIfNewer, clearSyncState } from '../sync/driveSync';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export default function UserPickerScreen() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');

  const googleProfile = getGoogleProfile();

  useEffect(() => {
    listUsers().then(setUsers).finally(() => setLoading(false));
    warmDatabase().catch(() => {}); // pre-load WASM so first openDatabase() doesn't cold-start
  }, []);

  // ── Open a local profile ────────────────────────────────────────────────────

  async function selectUser(name: string) {
    setOpening(name);
    try {
      await openDatabase(name);
      sessionStorage.setItem('currentUser', name);
      const profile = await getProfile();
      navigate(profile ? '/app/home' : '/onboarding');
    } catch {
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

  // ── Google sign-in ─────────────────────────────────────────────────────────

  // Shared helper: open DB (with auto-retry) then navigate into the app.
  async function openDbAndNavigate(username: string) {
    // openDatabase sets _db before running migrations; if a migration throws,
    // _db is already set and a second call returns immediately. Auto-retry.
    try { await openDatabase(username); } catch { await openDatabase(username); }
    sessionStorage.setItem('currentUser', username);
    const appProfile = await getProfile();
    navigate(appProfile ? '/app/home' : '/onboarding');
  }

  // Auth-code flow: gets both an access token and a refresh token from Google.
  // The code is exchanged server-side (/api/auth/token) so the client secret
  // never touches the browser.
  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    scope: DRIVE_SCOPE,
    onSuccess: async (codeResponse) => {
      setOpening('google');

      // Phase 1: exchange code → tokens, fetch profile, persist session.
      // Clear session on failure so the user can retry cleanly.
      let username: string;
      let accessToken: string;
      try {
        const tokenRes = await fetch('/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeResponse.code }),
        });
        if (!tokenRes.ok) throw new Error('Token exchange failed');
        const tokens = await tokenRes.json();
        accessToken = tokens.access_token;

        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const profile = await profileRes.json();
        saveGoogleSession(accessToken, tokens.expires_in ?? 3600, {
          name: profile.name, email: profile.email, picture: profile.picture,
        }, tokens.refresh_token);
        username = googleUsername({ name: profile.name, email: profile.email, picture: profile.picture });
      } catch {
        setError('Google sign-in failed. Please try again.');
        setOpening(null);
        return;
      }

      // Phase 2: open the database. Session is already saved, so don't
      // clear it on a DB failure — the user can retry via "Continue →".
      try {
        const driveData = await downloadIfNewer(accessToken);
        if (driveData) await importDatabase(username, driveData);
        await openDbAndNavigate(username);
      } catch {
        setError('Failed to open your profile. Please try again.');
        setOpening(null);
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or failed.');
      setOpening(null);
    },
  });

  // ── Continue as existing Google user ───────────────────────────────────────

  async function continueAsGoogle() {
    if (!googleProfile) return;
    setOpening('google');
    const username = googleUsername(googleProfile);
    const hasLocalDb = users.includes(username);

    // getOrRefreshToken: returns valid access token, refreshes silently if
    // expired (needs network + saved refresh token), or returns null.
    const token = await getOrRefreshToken();

    if (token) {
      // Online and authenticated — sync then open.
      try {
        const driveData = await downloadIfNewer(token);
        if (driveData) await importDatabase(username, driveData);
        await openDbAndNavigate(username);
      } catch {
        setError('Failed to open your profile. Please try again.');
        setOpening(null);
      }
    } else if (hasLocalDb) {
      // Offline or refresh failed — open the local database without sync.
      try {
        await openDbAndNavigate(username);
      } catch {
        setError('Failed to open your profile. Please try again.');
        setOpening(null);
      }
    } else {
      // No local database and no valid token — need full re-auth.
      setOpening(null);
      googleLogin();
    }
  }

  function disconnectGoogle() {
    clearGoogleSession();
    clearSyncState();
    window.location.reload();
  }

  // ─── Render ────────────────────────────────────────────────────────────────

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
            {/* ── Google account ── */}
            <div className="mb-6">
              {googleProfile ? (
                <div className="bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={googleProfile.picture}
                      alt={googleProfile.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-100 font-medium truncate">{googleProfile.name}</p>
                      <p className="text-slate-500 text-xs truncate">{googleProfile.email}</p>
                    </div>
                    <button
                      onClick={disconnectGoogle}
                      className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                  <button
                    onClick={continueAsGoogle}
                    disabled={opening !== null}
                    className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-colors"
                  >
                    {opening === 'google' ? 'Opening…' : 'Continue →'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => googleLogin()}
                  disabled={opening !== null}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-100 disabled:opacity-50 rounded-xl text-slate-900 font-semibold transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                    <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
                  </svg>
                  Sign in with Google
                </button>
              )}
            </div>

            {/* ── Other local profiles ── */}
            {users.filter(u => !isGoogleSignedIn() || u !== (googleProfile ? googleUsername(googleProfile) : '')).length > 0 && (
              <div className="mb-6 space-y-2">
                <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Local profiles</p>
                {users
                  .filter(u => !googleProfile || u !== googleUsername(googleProfile))
                  .map(u => (
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

            {/* ── Create local profile ── */}
            <div className="border-t border-slate-800 pt-6">
              <p className="text-slate-400 text-sm mb-3">New local profile</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && createUser()}
                  placeholder="Your name"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
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
