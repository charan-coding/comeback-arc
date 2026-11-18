import { Habit, LogRow, Player, ConfigMap, DEFAULT_CONFIG, Direction, HabitType, Category, Tier, Period } from './types';
import { ConfigRow } from '../lib/overrides';

/** Raw rows come back from Apps Script as loosely-typed sheet cells (strings/numbers/booleans/''). */
type RawRow = Record<string, unknown>;

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return Boolean(v);
}

function toNum(v: unknown, fallback = 0): number {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

function toOptionalStr(v: unknown): string | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  return String(v);
}

function toOptionalNum(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export function parseHabits(rows: RawRow[]): Habit[] {
  return rows.map((r) => ({
    habitId: String(r.habitId),
    name: String(r.name),
    category: r.category as Category,
    tier: r.tier as Tier,
    weight: toNum(r.weight, 1),
    type: r.type as HabitType,
    target: toNum(r.target),
    period: r.period as Period,
    active: toBool(r.active),
    direction: toOptionalStr(r.direction) as Direction | undefined,
    unit: toOptionalStr(r.unit),
    toleranceMinutes: toOptionalNum(r.toleranceMinutes),
    group: toOptionalStr(r.group),
  }));
}

export function parsePlayers(rows: RawRow[]): Player[] {
  return rows.map((r) => ({
    playerId: String(r.playerId),
    name: String(r.name),
    class: String(r.class),
    passHash: '',
    createdAt: String(r.createdAt),
  }));
}

export function parseLogs(rows: RawRow[]): LogRow[] {
  return rows.map((r) => ({
    date: String(r.date),
    playerId: String(r.playerId),
    habitId: String(r.habitId),
    value: toNum(r.value),
    done: toBool(r.done),
    updatedAt: String(r.updatedAt),
  }));
}

export function parseConfig(rows: ConfigRow[]): ConfigMap {
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    rolloverHour: toNum(map.rolloverHour, DEFAULT_CONFIG.rolloverHour),
    backfillDays: toNum(map.backfillDays, DEFAULT_CONFIG.backfillDays),
    cheatDayLimit: toNum(map.cheatDayLimit, DEFAULT_CONFIG.cheatDayLimit),
    goodDayThreshold: toNum(map.goodDayThreshold, DEFAULT_CONFIG.goodDayThreshold),
    coreWeightMultiplier: toNum(map.coreWeightMultiplier, DEFAULT_CONFIG.coreWeightMultiplier),
    restTokensPerWeek: toNum(map.restTokensPerWeek, DEFAULT_CONFIG.restTokensPerWeek),
    defaultEatingWindowHours: toNum(map.defaultEatingWindowHours, DEFAULT_CONFIG.defaultEatingWindowHours),
    defaultSleepToleranceMinutes: toNum(map.defaultSleepToleranceMinutes, DEFAULT_CONFIG.defaultSleepToleranceMinutes),
  };
}
