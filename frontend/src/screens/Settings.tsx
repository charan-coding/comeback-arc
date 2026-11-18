import React, { useEffect, useState } from 'react';
import { useApp } from '../store/AppProvider';
import { Card, SectionTitle } from '../components/ui/Card';
import { pushSupported, subscribeToPush, unsubscribeFromPush, getExistingSubscription, subscriptionToJson } from '../lib/push';
import { registerPush, unregisterPush } from '../api/client';

const THEME_KEY = 'comeback-arc:theme';
type Theme = 'dungeon' | 'parchment';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

const REMINDERS_KEY = 'comeback-arc:reminder-times';

export function Settings() {
  const { isDemoMode, online, syncing, pendingWrites, sync, error, session } = useApp();
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) as Theme) || 'dungeon');
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [morning, setMorning] = useState('09:00');
  const [evening, setEvening] = useState('20:00');
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!pushSupported) return;
    getExistingSubscription().then((sub) => setRemindersEnabled(Boolean(sub)));
    try {
      const saved = JSON.parse(localStorage.getItem(REMINDERS_KEY) ?? 'null');
      if (saved?.morning) setMorning(saved.morning);
      if (saved?.evening) setEvening(saved.evening);
    } catch {
      // ignore malformed local cache
    }
  }, []);

  async function enableReminders() {
    if (!session || !vapidPublicKey) return;
    setReminderBusy(true);
    setReminderError(null);
    try {
      const sub = await subscribeToPush(vapidPublicKey);
      const times = [morning, evening];
      await registerPush(session.playerId, session.passphrase, subscriptionToJson(sub), times);
      localStorage.setItem(REMINDERS_KEY, JSON.stringify({ morning, evening }));
      setRemindersEnabled(true);
    } catch (e) {
      setReminderError(e instanceof Error ? e.message : 'Could not enable reminders');
    } finally {
      setReminderBusy(false);
    }
  }

  async function disableReminders() {
    if (!session) return;
    setReminderBusy(true);
    setReminderError(null);
    try {
      await unsubscribeFromPush();
      await unregisterPush(session.playerId, session.passphrase);
      setRemindersEnabled(false);
    } catch (e) {
      setReminderError(e instanceof Error ? e.message : 'Could not disable reminders');
    } finally {
      setReminderBusy(false);
    }
  }

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

      {!isDemoMode && (
        <Card>
          <SectionTitle>Reminders</SectionTitle>
          {!pushSupported ? (
            <p className="text-sm text-parchment-300">This browser doesn't support push notifications.</p>
          ) : !vapidPublicKey ? (
            <p className="text-sm text-parchment-300">
              Reminders aren't configured yet — set VITE_VAPID_PUBLIC_KEY (see README) to enable this.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-parchment-200">
                Get a push notification if you haven't logged anything yet by these times.
              </p>
              <div className="mb-3 flex items-center gap-3">
                <label className="flex-1 text-sm text-parchment-100">
                  Morning
                  <input
                    type="time"
                    value={morning}
                    onChange={(e) => setMorning(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-md border border-dungeon-500 bg-dungeon-800 px-3 py-2 text-parchment-50"
                  />
                </label>
                <label className="flex-1 text-sm text-parchment-100">
                  Evening
                  <input
                    type="time"
                    value={evening}
                    onChange={(e) => setEvening(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-md border border-dungeon-500 bg-dungeon-800 px-3 py-2 text-parchment-50"
                  />
                </label>
              </div>
              {remindersEnabled ? (
                <button
                  onClick={disableReminders}
                  disabled={reminderBusy}
                  className="min-h-11 w-full rounded-md bg-hp-500/80 px-4 py-2 text-sm font-semibold text-parchment-50 disabled:opacity-40"
                >
                  {reminderBusy ? 'Working…' : 'Disable Reminders'}
                </button>
              ) : (
                <button
                  onClick={enableReminders}
                  disabled={reminderBusy}
                  className="min-h-11 w-full rounded-md bg-ember-500 px-4 py-2 text-sm font-semibold text-dungeon-900 disabled:opacity-40"
                >
                  {reminderBusy ? 'Working…' : 'Enable Reminders'}
                </button>
              )}
              {reminderError && <p className="mt-2 text-sm text-hp-500">{reminderError}</p>}
              <p className="mt-2 text-xs text-parchment-300">
                Reminders have no custom text per-notification (a deliberate simplification — see README), and are
                checked every ~15 minutes, so expect them within about 15 minutes of your chosen time.
              </p>
            </>
          )}
        </Card>
      )}

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
