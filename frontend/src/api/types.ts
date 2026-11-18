export type Category = 'Body' | 'Fuel' | 'Mind' | 'Discipline';
export type Tier = 'core' | 'bonus';
export type Period = 'daily' | 'weekly';

/**
 * How a habit's logged numeric `value` resolves to `done`.
 * - checkbox: value is 0 or 1
 * - counter: cumulative count (e.g. reps), can be logged in chunks
 * - duration: cumulative seconds (e.g. dead hangs)
 * - minutes / hours / grams / litres: cumulative unit amount
 * - count: a 0..target integer tally (e.g. meals cooked)
 * - time: minutes-since-midnight the event happened (bed/wake time)
 * - cheatday: 0 = failed, 1 = kept normally, 2 = passed via weekly cheat token
 * - checklist: 1 if every self-defined item is checked that day, else 0
 */
export type HabitType =
  | 'checkbox'
  | 'counter'
  | 'duration'
  | 'minutes'
  | 'hours'
  | 'grams'
  | 'litres'
  | 'count'
  | 'time'
  | 'cheatday'
  | 'checklist';

export type Direction = 'atLeast' | 'atMost';

export interface Habit {
  habitId: string;
  name: string;
  category: Category;
  tier: Tier;
  weight: number;
  type: HabitType;
  target: number;
  period: Period;
  active: boolean;
  direction?: Direction; // defaults to 'atLeast'
  unit?: string;
  toleranceMinutes?: number; // only used by 'time' habits
  group?: string; // UI grouping, e.g. 'workout'
}

export interface Player {
  playerId: string;
  name: string;
  class: string;
  passHash: string;
  createdAt: string; // ISO date (logical date of account creation)
  spriteUrl?: string; // player-uploaded avatar, shown in the Arena; blank until they upload one
}

export interface LogRow {
  date: string; // logical date, YYYY-MM-DD
  playerId: string;
  habitId: string;
  value: number;
  done: boolean;
  updatedAt: string; // ISO timestamp
}

export interface VisionBoardImage {
  imageId: string;
  playerId: string;
  imageUrl: string;
  width: number;
  height: number;
  addedAt: string;
}

export interface ConfigMap {
  rolloverHour: number;
  backfillDays: number;
  cheatDayLimit: number;
  goodDayThreshold: number;
  coreWeightMultiplier: number;
  restTokensPerWeek: number;
  defaultEatingWindowHours: number;
  defaultSleepToleranceMinutes: number;
}

export const DEFAULT_CONFIG: ConfigMap = {
  rolloverHour: 4,
  backfillDays: 3,
  cheatDayLimit: 1,
  goodDayThreshold: 0.7,
  coreWeightMultiplier: 2,
  restTokensPerWeek: 1,
  defaultEatingWindowHours: 8,
  defaultSleepToleranceMinutes: 0,
};
