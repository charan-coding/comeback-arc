import { Habit, LogRow, ConfigMap, DEFAULT_CONFIG, Category } from '../api/types';
import { weekKey, weekDates, minutesSinceRollover, daysBetween, addDays, isSameOrBefore } from './day';

export function effectiveWeight(habit: Habit, config: ConfigMap = DEFAULT_CONFIG): number {
  return habit.tier === 'core' ? habit.weight * config.coreWeightMultiplier : habit.weight;
}

export function resolveSimpleDone(habit: Habit, value: number): boolean {
  const direction = habit.direction ?? 'atLeast';
  if (habit.type === 'time') {
    return (
      minutesSinceRollover(value) <=
      minutesSinceRollover(habit.target) + (habit.toleranceMinutes ?? 0)
    );
  }
  return direction === 'atLeast' ? value >= habit.target : value <= habit.target;
}

/**
 * Resolves the no-sugar ("cheatday") habit for one date, honoring the weekly cheat-day
 * limit: only the earliest `cheatDayLimit` cheat-token usages in the week count as allowed;
 * any later one fails that day even though the player logged a cheat token.
 */
export function resolveCheatDayDone(date: string, weekLogsForHabit: LogRow[], cheatDayLimit: number): boolean {
  const cheatDatesInOrder = weekLogsForHabit
    .filter((l) => l.value === 2)
    .map((l) => l.date)
    .sort();
  const allowedCheatDates = new Set(cheatDatesInOrder.slice(0, cheatDayLimit));
  const row = weekLogsForHabit.find((l) => l.date === date);
  if (!row) return false;
  if (row.value === 2) return allowedCheatDates.has(date);
  return row.value >= 1;
}

export interface DailyScoreResult {
  date: string;
  score: number;
  coreDone: boolean;
  anyLogged: boolean;
  perHabit: Record<string, boolean>;
}

export function computeDailyScore(
  date: string,
  playerId: string,
  playerLogs: LogRow[],
  habits: Habit[],
  config: ConfigMap = DEFAULT_CONFIG
): DailyScoreResult {
  const dailyHabits = habits.filter((h) => h.active && h.period === 'daily');
  const rowsForDate = playerLogs.filter((l) => l.playerId === playerId && l.date === date);
  const byHabit = new Map(rowsForDate.map((l) => [l.habitId, l] as const));

  let totalWeight = 0;
  let doneWeight = 0;
  let coreDone = true;
  const perHabit: Record<string, boolean> = {};

  for (const habit of dailyHabits) {
    const w = effectiveWeight(habit, config);
    totalWeight += w;
    let done = false;

    if (habit.type === 'cheatday') {
      const wk = weekKey(date);
      const weekLogs = playerLogs.filter(
        (l) => l.playerId === playerId && l.habitId === habit.habitId && weekKey(l.date) === wk
      );
      done = resolveCheatDayDone(date, weekLogs, config.cheatDayLimit);
    } else {
      const row = byHabit.get(habit.habitId);
      done = row ? resolveSimpleDone(habit, row.value) : false;
    }

    perHabit[habit.habitId] = done;
    if (done) doneWeight += w;
    if (habit.tier === 'core' && !done) coreDone = false;
  }

  return {
    date,
    score: totalWeight > 0 ? doneWeight / totalWeight : 0,
    coreDone,
    anyLogged: rowsForDate.length > 0,
    perHabit,
  };
}

export function isGoodDay(result: DailyScoreResult, config: ConfigMap = DEFAULT_CONFIG): boolean {
  return result.score >= config.goodDayThreshold && result.coreDone;
}

export interface StreakResult {
  current: number;
  longest: number;
}

/**
 * Walks `startDate..endDate` in order. A good day extends the streak; a bad day breaks it
 * unless a weekly rest token is still available, in which case the streak is protected
 * (held flat, not incremented) and the token is spent. Tokens refill every ISO week.
 */
export function computeStreaks(
  playerId: string,
  playerLogs: LogRow[],
  habits: Habit[],
  config: ConfigMap,
  startDate: string,
  endDate: string
): StreakResult {
  const dates = daysBetween(startDate, endDate);
  let current = 0;
  let longest = 0;
  const tokensUsedByWeek = new Map<string, number>();

  for (const date of dates) {
    const result = computeDailyScore(date, playerId, playerLogs, habits, config);
    if (isGoodDay(result, config)) {
      current += 1;
    } else {
      const wk = weekKey(date);
      const used = tokensUsedByWeek.get(wk) ?? 0;
      if (used < config.restTokensPerWeek) {
        tokensUsedByWeek.set(wk, used + 1);
      } else {
        current = 0;
      }
    }
    if (current > longest) longest = current;
  }

  return { current, longest };
}

export interface ConsistencyResult {
  goodDays: number;
  totalDays: number;
  consistencyRate: number;
  showedUpDays: number;
  showedUpRate: number;
}

/**
 * Computes consistency over a trailing window, clipped to the player's own start date so a
 * player who joined later is never penalized for days before they could have logged anything.
 */
export function computeConsistency(
  playerId: string,
  playerLogs: LogRow[],
  habits: Habit[],
  config: ConfigMap,
  windowDays: number | 'all',
  endDate: string,
  playerStartDate: string
): ConsistencyResult {
  const naiveStart = windowDays === 'all' ? playerStartDate : addDays(endDate, -(windowDays - 1));
  const windowStart = isSameOrBefore(playerStartDate, naiveStart) ? naiveStart : playerStartDate;
  const dates = isSameOrBefore(windowStart, endDate) ? daysBetween(windowStart, endDate) : [];

  let goodDays = 0;
  let showedUpDays = 0;
  for (const date of dates) {
    const result = computeDailyScore(date, playerId, playerLogs, habits, config);
    if (isGoodDay(result, config)) goodDays += 1;
    if (result.anyLogged) showedUpDays += 1;
  }

  const totalDays = dates.length;
  return {
    goodDays,
    totalDays,
    consistencyRate: totalDays > 0 ? goodDays / totalDays : 0,
    showedUpDays,
    showedUpRate: totalDays > 0 ? showedUpDays / totalDays : 0,
  };
}

export type CategoryRates = Record<Category, { done: number; total: number; rate: number }>;

export function computeCategoryRates(
  playerId: string,
  playerLogs: LogRow[],
  habits: Habit[],
  config: ConfigMap,
  startDate: string,
  endDate: string
): CategoryRates {
  const dates = daysBetween(startDate, endDate);
  const categories: Category[] = ['Body', 'Fuel', 'Mind', 'Discipline'];
  const out = Object.fromEntries(categories.map((c) => [c, { done: 0, total: 0, rate: 0 }])) as CategoryRates;
  const dailyHabits = habits.filter((h) => h.active && h.period === 'daily');

  for (const date of dates) {
    const result = computeDailyScore(date, playerId, playerLogs, habits, config);
    for (const habit of dailyHabits) {
      out[habit.category].total += 1;
      if (result.perHabit[habit.habitId]) out[habit.category].done += 1;
    }
  }

  for (const cat of categories) {
    out[cat].rate = out[cat].total > 0 ? out[cat].done / out[cat].total : 0;
  }
  return out;
}

export interface WeeklyStudyResult {
  habitId: string;
  weekStart: string;
  totalHours: number;
  pass: boolean;
  perfect: boolean;
}

/** Sums a weekly habit's per-day logged hours Mon-Sun. `habit.target` is the pass threshold (default 4h); perfect is 2x that. */
export function computeWeeklyStudy(
  playerId: string,
  playerLogs: LogRow[],
  habits: Habit[],
  mondayDate: string
): WeeklyStudyResult[] {
  const weeklyHabits = habits.filter((h) => h.active && h.period === 'weekly');
  const days = weekDates(mondayDate);

  return weeklyHabits.map((habit) => {
    const totalHours = days.reduce((sum, d) => {
      const row = playerLogs.find((l) => l.playerId === playerId && l.date === d && l.habitId === habit.habitId);
      return sum + (row ? row.value : 0);
    }, 0);
    const passTarget = habit.target || 4;
    return {
      habitId: habit.habitId,
      weekStart: mondayDate,
      totalHours,
      pass: totalHours >= passTarget,
      perfect: totalHours >= passTarget * 2,
    };
  });
}
