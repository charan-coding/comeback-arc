import React, { useEffect, useState } from 'react';
import { useApp } from '../store/AppProvider';
import { Card, SectionTitle } from '../components/ui/Card';

const THEME_KEY = 'comeback-arc:theme';
type Theme = 'dungeon' | 'parchment';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function Settings() {
  const { isDemoMode, online, syncing, pendingWrites, sync, error } = useApp();
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) as Theme) || 'dungeon');

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

  return (
    <div className="space-y-4 pb-24">
      <Card>
        <SectionTitle>Connection</SectionTitle>
        <p className="text-sm text-parchment-100">{isDemoMode ? 'Demo mode — no API connected.' : apiUrl}</p>
        <p className="mt-1 text-sm">
          Status: <span className={online ? 'text-good-500' : 'text-hp-500'}>{online ? 'Online' : 'Offline'}</span>
        </p>
        {!isDemoMode && (
          <>
            <p className="mt-1 text-sm text-parchment-200">Pending writes: {pendingWrites}</p>
            <button
              onClick={() => sync()}
              disabled={syncing || !online}
              className="mt-3 min-h-11 rounded-md bg-ember-500 px-4 py-2 text-sm font-semibold text-dungeon-900 disabled:opacity-40"
            >
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </>
        )}
        {error && <p className="mt-2 text-sm text-hp-500">{error}</p>}
      </Card>

      <Card>
        <SectionTitle>Theme</SectionTitle>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme('dungeon')}
            className={`min-h-11 flex-1 rounded-md px-3 py-2 text-sm ${theme === 'dungeon' ? 'bg-ember-500 text-dungeon-900' : 'bg-dungeon-600 text-parchment-100'}`}
          >
            Dark Dungeon
          </button>
          <button
            onClick={() => setTheme('parchment')}
            className={`min-h-11 flex-1 rounded-md px-3 py-2 text-sm ${theme === 'parchment' ? 'bg-ember-500 text-dungeon-900' : 'bg-dungeon-600 text-parchment-100'}`}
          >
            Parchment
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle>About</SectionTitle>
        <p className="text-sm text-parchment-200">
          Comeback Arc — a tabletop-RPG themed habit tracker. Auth is a shared passphrase per player, hashed on the
          backend; it's meant for a small trusted group of friends, not a security boundary.
        </p>
      </Card>
    </div>
  );
}
