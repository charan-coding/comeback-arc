import { Habit, LogRow, Player, ConfigMap } from './types';
import { parseHabits, parseLogs, parsePlayers, parseConfig } from './parse';
import { ConfigRow } from '../lib/overrides';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

export const isDemoMode = !API_URL;

export interface ReadResult {
  players: Player[];
  habits: Habit[];
  logs: LogRow[];
  config: ConfigMap;
  configRows: ConfigRow[];
}

class ApiError extends Error {}

export async function fetchAll(since?: string): Promise<ReadResult> {
  if (!API_URL) throw new ApiError('No API URL configured (demo mode)');
  const url = new URL(API_URL);
  url.searchParams.set('action', 'read');
  if (since) url.searchParams.set('since', since);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!json.ok) throw new ApiError(json.error || 'Failed to load data');

  return {
    players: parsePlayers(json.players),
    habits: parseHabits(json.habits),
    logs: parseLogs(json.logs),
    config: parseConfig(json.config),
    configRows: json.config,
  };
}

/**
 * Sent as text/plain so the browser never issues a CORS preflight — Apps Script Web Apps
 * can't answer an OPTIONS request. The server parses the body as JSON regardless.
 */
async function post<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  if (!API_URL) throw new ApiError('No API URL configured (demo mode)');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new ApiError(json.error || 'Request failed');
  return json as T;
}

export async function createPlayer(name: string, playerClass: string, passphrase: string, logicalDate: string) {
  return post<{ player: Player }>({ action: 'createPlayer', name, class: playerClass, passphrase, logicalDate });
}

export async function login(playerId: string, passphrase: string) {
  return post<{ player: Player }>({ action: 'login', playerId, passphrase });
}

export async function logHabit(playerId: string, passphrase: string, date: string, habitId: string, value: number) {
  return post<{ updatedAt: string }>({ action: 'logHabit', playerId, passphrase, date, habitId, value });
}

export interface BatchEntry {
  date: string;
  habitId: string;
  value: number;
}

export async function logBatch(playerId: string, passphrase: string, entries: BatchEntry[]) {
  return post<{ updatedAt: string; rejected: BatchEntry[] }>({ action: 'logBatch', playerId, passphrase, entries });
}

export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function registerPush(playerId: string, passphrase: string, subscription: PushSubscriptionJson, reminderTimes: string[]) {
  return post<{ ok: true }>({ action: 'registerPush', playerId, passphrase, subscription, reminderTimes });
}

export async function unregisterPush(playerId: string, passphrase: string) {
  return post<{ ok: true }>({ action: 'unregisterPush', playerId, passphrase });
}

export async function setHabitOverride(
  playerId: string,
  passphrase: string,
  habitId: string,
  field: 'target' | 'active',
  value: number | boolean
) {
  return post<{ ok: true }>({ action: 'setHabitOverride', playerId, passphrase, habitId, field, value });
}
