import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Player, Habit, LogRow, ConfigMap, VisionBoardImage } from '../api/types';
import * as api from '../api/client';
import { parseConfig } from '../api/parse';
import { ConfigRow } from '../lib/overrides';
import { generateDemoData } from '../lib/demoData';
import { DEFAULT_HABITS } from '../lib/habitDefs';
import * as sessionStore from './session';
import * as queue from './offlineQueue';
import { parseOverrides, habitsForPlayer } from '../lib/overrides';
import { today } from '../lib/day';

const CACHE_KEY = 'comeback-arc:cache';

interface Cache {
  players: Player[];
  habits: Habit[];
  logs: LogRow[];
  configRows: ConfigRow[];
  visionBoard: VisionBoardImage[];
}

function loadCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

function saveCache(cache: Cache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // best-effort cache; ignore quota errors
  }
}

function configMapToRows(config: ConfigMap): ConfigRow[] {
  return Object.entries(config).map(([key, value]) => ({ key, value: String(value) }));
}

export interface AppContextValue {
  isDemoMode: boolean;
  loading: boolean;
  error: string | null;
  online: boolean;
  syncing: boolean;
  pendingWrites: number;

  session: sessionStore.Session | null;
  login: (playerId: string, passphrase: string) => Promise<void>;
  createPlayer: (name: string, playerClass: string, passphrase: string) => Promise<void>;
  logout: () => void;

  players: Player[];
  baseHabits: Habit[];
  myHabits: Habit[];
  habitsForPlayerId: (playerId: string) => Habit[];
  logs: LogRow[];
  config: ConfigMap;
  visionBoard: VisionBoardImage[];

  logHabit: (date: string, habitId: string, value: number) => void;
  setOverride: (habitId: string, field: 'target' | 'active', value: number | boolean) => Promise<void>;
  uploadSprite: (imageBase64: string, mimeType: string) => Promise<string>;
  addVisionBoardImage: (imageBase64: string, mimeType: string, width: number, height: number) => Promise<void>;
  removeVisionBoardImage: (imageId: string) => Promise<void>;
  sync: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const demo = api.isDemoMode;
  const [sessionState, setSessionState] = useState<sessionStore.Session | null>(() => sessionStore.getSession());
  const [players, setPlayers] = useState<Player[]>([]);
  const [baseHabits, setBaseHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [configRows, setConfigRows] = useState<ConfigRow[]>([]);
  const [visionBoard, setVisionBoard] = useState<VisionBoardImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pendingWrites, setPendingWrites] = useState(0);

  const config = useMemo(() => parseConfig(configRows), [configRows]);
  const overrides = useMemo(() => parseOverrides(configRows), [configRows]);
  const myHabits = useMemo(
    () => (sessionState ? habitsForPlayer(baseHabits, overrides, sessionState.playerId) : baseHabits),
    [baseHabits, overrides, sessionState]
  );
  const habitsForPlayerId = useCallback(
    (playerId: string) => habitsForPlayer(baseHabits, overrides, playerId),
    [baseHabits, overrides]
  );

  const refreshPendingCount = useCallback(async () => {
    const q = await queue.getQueue();
    setPendingWrites(q.length);
  }, []);

  // Initial load: demo data, or cached-then-live for the real API.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (demo) {
        const data = generateDemoData();
        if (!mounted) return;
        setPlayers(data.players);
        setBaseHabits(data.habits);
        setLogs(data.logs);
        setConfigRows(configMapToRows(data.config));
        setLoading(false);
        setSessionState((prev) =>
          prev ?? { playerId: data.players[0].playerId, name: data.players[0].name, class: data.players[0].class, passphrase: '' }
        );
        return;
      }

      const cache = loadCache();
      if (cache) {
        setPlayers(cache.players);
        setBaseHabits(cache.habits);
        setLogs(cache.logs);
        setConfigRows(cache.configRows);
        setVisionBoard(cache.visionBoard ?? []);
        setLoading(false);
      }
      try {
        const result = await api.fetchAll();
        if (!mounted) return;
        setPlayers(result.players);
        setBaseHabits(result.habits);
        setLogs(result.logs);
        setConfigRows(result.configRows);
        setVisionBoard(result.visionBoard);
        setLoading(false);
        saveCache({
          players: result.players,
          habits: result.habits,
          logs: result.logs,
          configRows: result.configRows,
          visionBoard: result.visionBoard,
        });
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load data');
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [demo]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!demo) {
      saveCache({ players, habits: baseHabits, logs, configRows, visionBoard });
    }
  }, [demo, players, baseHabits, logs, configRows, visionBoard]);

  const sync = useCallback(async () => {
    if (demo || !sessionState || !online) return;
    const pending = await queue.getQueue();
    if (pending.length === 0) return;
    setSyncing(true);
    try {
      const res = await api.logBatch(
        sessionState.playerId,
        sessionState.passphrase,
        pending.map(({ date, habitId, value }) => ({ date, habitId, value }))
      );
      const rejectedKeys = new Set(res.rejected.map((r) => `${r.date}:${r.habitId}`));
      const succeededIds = pending.filter((e) => !rejectedKeys.has(`${e.date}:${e.habitId}`)).map((e) => e.id);
      await queue.removeFromQueue(succeededIds);
      await refreshPendingCount();

      const result = await api.fetchAll();
      setPlayers(result.players);
      setBaseHabits(result.habits);
      setLogs(result.logs);
      setConfigRows(result.configRows);
      setVisionBoard(result.visionBoard);
      saveCache({
        players: result.players,
        habits: result.habits,
        logs: result.logs,
        configRows: result.configRows,
        visionBoard: result.visionBoard,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [demo, sessionState, online, refreshPendingCount]);

  useEffect(() => {
    if (online) sync();
    const interval = setInterval(() => {
      if (online) sync();
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const logHabit = useCallback(
    (date: string, habitId: string, value: number) => {
      if (!sessionState) return;
      const updatedAt = new Date().toISOString();
      setLogs((prev) => {
        const idx = prev.findIndex((l) => l.date === date && l.playerId === sessionState.playerId && l.habitId === habitId);
        const row: LogRow = { date, playerId: sessionState.playerId, habitId, value, done: value > 0, updatedAt };
        if (idx === -1) return [...prev, row];
        const next = [...prev];
        next[idx] = row;
        return next;
      });

      if (demo) return;

      if (online) {
        api.logHabit(sessionState.playerId, sessionState.passphrase, date, habitId, value).catch(() => {
          queue.enqueue({ date, habitId, value }).then(refreshPendingCount);
        });
      } else {
        queue.enqueue({ date, habitId, value }).then(refreshPendingCount);
      }
    },
    [sessionState, demo, online, refreshPendingCount]
  );

  const login = useCallback(async (playerId: string, passphrase: string) => {
    const res = await api.login(playerId, passphrase);
    const s: sessionStore.Session = { playerId: res.player.playerId, name: res.player.name, class: res.player.class, passphrase };
    sessionStore.saveSession(s);
    setSessionState(s);
  }, []);

  const createPlayer = useCallback(
    async (name: string, playerClass: string, passphrase: string) => {
      const res = await api.createPlayer(name, playerClass, passphrase, today(config.rolloverHour));
      const s: sessionStore.Session = { playerId: res.player.playerId, name: res.player.name, class: res.player.class, passphrase };
      sessionStore.saveSession(s);
      setSessionState(s);
      const result = await api.fetchAll();
      setPlayers(result.players);
      setBaseHabits(result.habits);
      setLogs(result.logs);
      setConfigRows(result.configRows);
    },
    [config.rolloverHour]
  );

  const logout = useCallback(() => {
    sessionStore.clearSession();
    setSessionState(null);
  }, []);

  const setOverride = useCallback(
    async (habitId: string, field: 'target' | 'active', value: number | boolean) => {
      if (!sessionState) return;
      const key = `override.${sessionState.playerId}.${habitId}.${field}`;
      setConfigRows((prev) => [...prev.filter((r) => r.key !== key), { key, value: String(value) }]);
      if (demo) return;
      await api.setHabitOverride(sessionState.playerId, sessionState.passphrase, habitId, field, value);
    },
    [sessionState, demo]
  );

  const uploadSprite = useCallback(
    async (imageBase64: string, mimeType: string) => {
      if (!sessionState) throw new Error('Not signed in');
      if (demo) {
        const localUrl = `data:${mimeType};base64,${imageBase64}`;
        setPlayers((prev) => prev.map((p) => (p.playerId === sessionState.playerId ? { ...p, spriteUrl: localUrl } : p)));
        return localUrl;
      }
      const res = await api.uploadSprite(sessionState.playerId, sessionState.passphrase, imageBase64, mimeType);
      setPlayers((prev) => prev.map((p) => (p.playerId === sessionState.playerId ? { ...p, spriteUrl: res.spriteUrl } : p)));
      return res.spriteUrl;
    },
    [sessionState, demo]
  );

  const addVisionBoardImage = useCallback(
    async (imageBase64: string, mimeType: string, width: number, height: number) => {
      if (!sessionState) return;
      if (demo) {
        const localUrl = `data:${mimeType};base64,${imageBase64}`;
        setVisionBoard((prev) => [
          ...prev,
          { imageId: `local_${Date.now()}`, playerId: sessionState.playerId, imageUrl: localUrl, width, height, addedAt: new Date().toISOString() },
        ]);
        return;
      }
      const res = await api.addVisionBoardImage(sessionState.playerId, sessionState.passphrase, imageBase64, mimeType, width, height);
      setVisionBoard((prev) => [
        ...prev,
        { imageId: res.imageId, playerId: sessionState.playerId, imageUrl: res.imageUrl, width, height, addedAt: new Date().toISOString() },
      ]);
    },
    [sessionState, demo]
  );

  const removeVisionBoardImage = useCallback(
    async (imageId: string) => {
      if (!sessionState) return;
      setVisionBoard((prev) => prev.filter((img) => img.imageId !== imageId));
      if (demo) return;
      await api.removeVisionBoardImage(sessionState.playerId, sessionState.passphrase, imageId);
    },
    [sessionState, demo]
  );

  const value: AppContextValue = {
    isDemoMode: demo,
    loading,
    error,
    online,
    syncing,
    pendingWrites,
    session: sessionState,
    login,
    createPlayer,
    logout,
    players,
    baseHabits,
    myHabits,
    habitsForPlayerId,
    logs,
    config,
    visionBoard,
    logHabit,
    setOverride,
    uploadSprite,
    addVisionBoardImage,
    removeVisionBoardImage,
    sync,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
