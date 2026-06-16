import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { openDatabase, getProfile, warmDatabase } from '../database/db';
import {
  saveGoogleSession, getGoogleProfile, getOrRefreshToken, clearGoogleSession,
  googleUsername,
} from '../auth/googleAuth';
import { syncWithDrive, clearSyncState } from '../sync/driveSync';
import { LANGUAGES } from '../data/languages';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export default function UserPickerScreen() {
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const [openStatus, setOpenStatus] = useState('');
  const [error, setError] = useState('');
  const [language, setLanguage] = useState<string>(() => sessionStorage.getItem('currentLanguage') ?? 'sw');

  const googleProfile = getGoogleProfile();

  useEffect(() => {
    warmDatabase().catch(() => {}); // pre-load WASM so first openDatabase() doesn't cold-start
  }, []);

  async function openDbAndNavigate(username: string, token?: string) {
    // Retry once — first-load WASM init can fail transiently.
    try { await openDatabase(username, language); } catch { await openDatabase(username, language); }
    sessionStorage.setItem('currentUser', username);
    sessionStorage.setItem('currentLanguage', language);

    // Drive sync currently targets the Swahili profile only.
    if (language === 'sw' && (token || navigator.onLine)) {
      setOpenStatus('Syncing…');
      await syncWithDrive({ tokenOverride: token, allowRefresh: true }).catch(() => {});
      setOpenStatus('');
    }

    const appProfile = await getProfile();
    navigate(appProfile ? '/app/home' : '/onboarding');
  }

  // Implicit flow: Google returns the access token directly — no backend exchange needed.
  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    scope: DRIVE_SCOPE,
    onSuccess: async (tokenResponse) => {
      setOpening(true);
      let username: string;
      let accessToken: string;
      try {
        accessToken = tokenResponse.access_token;
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const profile = await profileRes.json();
        saveGoogleSession(accessToken, tokenResponse.expires_in ?? 3600, {
          name: profile.name, email: profile.email, picture: profile.picture,
        });
        username = googleUsername({ name: profile.name, email: profile.email, picture: profile.picture });
      } catch {
        setError('Google sign-in failed. Please try again.');
        setOpening(false);
        return;
      }
      try {
        await openDbAndNavigate(username, accessToken);
      } catch {
        setError('Failed to open your profile. Please try again.');
        setOpening(false);
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or failed.');
      setOpening(false);
    },
  });

  async function continueAsGoogle() {
    if (!googleProfile) return;
    setOpening(true);
    const username = googleUsername(googleProfile);
    const token = await getOrRefreshToken();
    if (token) {
      // Online — open then merge.
      try {
        await openDbAndNavigate(username, token);
      } catch {
        setError('Failed to open your profile. Please try again.');
        setOpening(false);
      }
    } else {
      // Token expired — getOrRefreshToken already attempted a silent GIS refresh
      // and failed (or we're offline). Open the local copy; sync will be retried
      // automatically next session once a valid token is available.
      try {
        await openDbAndNavigate(username);
      } catch {
        // No local copy at all — need a full sign-in.
        setOpening(false);
        googleLogin();
      }
    }
  }

  function switchAccounts() {
    clearGoogleSession();
    clearSyncState();
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">{googleProfile ? (LANGUAGES[language]?.flag ?? '🌍') : '🌍'}</div>
          <h1 className="text-3xl font-bold text-slate-100">
            {googleProfile ? (LANGUAGES[language]?.name ?? 'Learn') : 'Sign in to continue'}
          </h1>
          <p className="text-slate-400 mt-1">
            {googleProfile ? 'Choose a language to learn' : 'Sign in with Google to get started'}
          </p>
        </div>

        {googleProfile ? (
          <>
            {/* Language picker — shown after auth so the user picks per-session */}
            <div className="flex gap-2 mb-6">
              {Object.values(LANGUAGES).map(l => (
                <button
                  key={l.id}
                  onClick={() => setLanguage(l.id)}
                  aria-pressed={language === l.id}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    language === l.id ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span aria-hidden="true">{l.flag}</span> {l.name}
                </button>
              ))}
            </div>

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
              </div>
              <button
                onClick={continueAsGoogle}
                disabled={opening}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-colors"
              >
                {opening ? (openStatus || 'Opening…') : 'Continue →'}
              </button>
              <button
                onClick={switchAccounts}
                disabled={opening}
                className="w-full mt-2 py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                Switch accounts
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => googleLogin()}
            disabled={opening}
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

        {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
      </div>
    </div>
  );
}
