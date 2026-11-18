import React from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useApp } from './store/AppProvider';
import { Today } from './screens/Today';
import { Party } from './screens/Party';
import { Compare } from './screens/Compare';
import { Arena } from './screens/Arena';
import { Me } from './screens/Me';
import { Settings } from './screens/Settings';
import { Login } from './screens/Login';

const TABS = [
  { to: '/', label: 'Today', icon: '📜' },
  { to: '/party', label: 'Party', icon: '🛡️' },
  { to: '/compare', label: 'Compare', icon: '⚔️' },
  { to: '/arena', label: 'Arena', icon: '🏟️' },
  { to: '/me', label: 'Me', icon: '🧙' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

function Shell() {
  const { session, loading } = useApp();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-parchment-200">Loading the dungeon…</div>;
  }
  if (!session) {
    return <Login />;
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/party" element={<Party />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/arena" element={<Arena />} />
        <Route path="/me" element={<Me />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-lg border-t border-dungeon-600 bg-dungeon-800/95 backdrop-blur">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-transform active:scale-90 ${
                isActive ? 'text-ember-400' : 'text-parchment-300'
              }`
            }
          >
            <span className="text-xl">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
