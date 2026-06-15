import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { getCurrentUser, openDatabase, getProfile } from '../database/db';
import { applyDisplaySettings } from '../utils/display';
import { syncWithDrive } from '../sync/driveSync';

const tabs = [
  { to: '/app/home',    label: 'Home',    icon: '🏠' },
  { to: '/app/learn',   label: 'Learn',   icon: '📚' },
  { to: '/app/units',   label: 'Units',   icon: '🗺️' },
  { to: '/app/grammar', label: 'Grammar', icon: '🧩' },
  { to: '/app/gallery', label: 'Gallery', icon: '🔤' },
  { to: '/app/stats',   label: 'Stats',   icon: '📊' },
  { to: '/app/settings',label: 'Settings',icon: '⚙️' },
];

export default function Layout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(getCurrentUser() !== null);

  useEffect(() => {
    if (getCurrentUser() !== null) {
      setReady(true);
      getProfile().then(p => { if (p) applyDisplaySettings(p.settings); });
      return;
    }
    const stored = sessionStorage.getItem('currentUser');
    if (!stored) { navigate('/', { replace: true }); return; }
    openDatabase(stored)
      .catch(() => openDatabase(stored))  // retry once for WASM cold-start
      .then(() => {
        setReady(true);
        getProfile().then(p => { if (p) applyDisplaySettings(p.settings); });
      })
      .catch(() => { sessionStorage.removeItem('currentUser'); navigate('/', { replace: true }); });
  }, []);

  // Background sync: upload to Drive when coming back online or returning to the tab.
  useEffect(() => {
    function trySyncIfOnline() {
      if (navigator.onLine && getCurrentUser() !== null) syncWithDrive();
    }
    const handleVisibility = () => { if (!document.hidden) trySyncIfOnline(); };
    window.addEventListener('online', trySyncIfOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', trySyncIfOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (!ready) return null;

  return (
    <div className="flex flex-col bg-slate-950" style={{ height: '100dvh' }}>
      <main className="flex-1 overflow-y-auto min-h-0">
        <Outlet />
      </main>
      <nav aria-label="Main" className="shrink-0 flex border-t border-slate-800 bg-slate-900 pb-safe">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors ${
                isActive ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <span className="text-xl" aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
