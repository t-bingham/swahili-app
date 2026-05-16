import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { getCurrentUser, openDatabase } from '../database/db';

const tabs = [
  { to: '/app/home', label: 'Home', icon: '🏠' },
  { to: '/app/learn', label: 'Learn', icon: '📚' },
  { to: '/app/units', label: 'Units', icon: '🗺️' },
  { to: '/app/stats', label: 'Stats', icon: '📊' },
  { to: '/app/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(getCurrentUser() !== null);

  useEffect(() => {
    if (getCurrentUser() !== null) { setReady(true); return; }
    const stored = sessionStorage.getItem('currentUser');
    if (!stored) { navigate('/', { replace: true }); return; }
    openDatabase(stored)
      .then(() => setReady(true))
      .catch(() => { sessionStorage.removeItem('currentUser'); navigate('/', { replace: true }); });
  }, []);

  if (!ready) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav className="flex border-t border-slate-800 bg-slate-900">
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
            <span className="text-xl">{t.icon}</span>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
