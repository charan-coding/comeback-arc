import { Habit } from '../api/types';

export interface ConfigRow {
  key: string;
  value: string;
}

export type OverridesByPlayer = Record<string, Record<string, { target?: number; active?: boolean }>>;

const OVERRIDE_KEY = /^override\.([^.]+)\.([^.]+)\.(target|active)$/;

export function parseOverrides(configRows: ConfigRow[]): OverridesByPlayer {
  const out: OverridesByPlayer = {};
  for (const row of configRows) {
    const match = OVERRIDE_KEY.exec(row.key);
    if (!match) continue;
    const [, playerId, habitId, field] = match;
    out[playerId] ??= {};
    out[playerId][habitId] ??= {};
    if (field === 'target') out[playerId][habitId].target = Number(row.value);
    else out[playerId][habitId].active = row.value === 'true';
  }
  return out;
}

/** Applies one player's own target/active overrides on top of the shared Habits config. */
export function habitsForPlayer(baseHabits: Habit[], overrides: OverridesByPlayer, playerId: string): Habit[] {
  const playerOverrides = overrides[playerId] ?? {};
  return baseHabits.map((h) => {
    const ov = playerOverrides[h.habitId];
    if (!ov) return h;
    return { ...h, target: ov.target ?? h.target, active: ov.active ?? h.active };
  });
}
