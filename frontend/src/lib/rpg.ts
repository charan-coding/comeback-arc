import { Habit, LogRow, ConfigMap, DEFAULT_CONFIG } from '../api/types';
import { weekDates, weekKey, daysBetween, addDays } from './day';
import {
  computeDailyScore,
  isGoodDay,
  computeWeeklyStudy,
  DailyScoreResult,
  WeeklyStudyResult,
} from './scoring';

export const XP_PER_CORE_HABIT = 15;
export const XP_PER_BONUS_HABIT = 10;
export const XP_GOOD_DAY_BONUS = 20;

export function xpForDay(result: DailyScoreResult, habits: Habit[], config: ConfigMap = DEFAULT_CONFIG): number {
  const dailyHabits = habits.filter((h) => h.active && h.period === 'daily');
  let xp = 0;
  for (const habit of dailyHabits) {
    if (result.perHabit[habit.habitId]) {
      xp += habit.tier === 'core' ? XP_PER_CORE_HABIT : XP_PER_BONUS_HABIT;
    }
  }
  if (isGoodDay(result, config)) xp += XP_GOOD_DAY_BONUS;
  return xp;
}

export function totalXp(
  playerId: string,
  playerLogs: LogRow[],
  habits: Habit[],
  config: ConfigMap,
  startDate: string,
  endDate: string
): number {
  return daysBetween(startDate, endDate).reduce((sum, date) => {
    const result = computeDailyScore(date, playerId, playerLogs, habits, config);
    return sum + xpForDay(result, habits, config);
  }, 0);
}

/** XP required to REACH a given level; level 1 requires 0. */
export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(Math.max(level - 1, 0), 1.5));
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return {
    level,
    xpIntoLevel: xp - xpForLevel(level),
    xpForNextLevel: xpForLevel(level + 1) - xpForLevel(level),
  };
}

export function classTitle(baseClass: string, level: number): string {
  if (level >= 20) return `Legendary ${baseClass}`;
  if (level >= 10) return `Veteran ${baseClass}`;
  if (level >= 5) return baseClass;
  return `Novice ${baseClass}`;
}

export interface FloorResult {
  weekStart: string;
  weeklyScore: number;
  goodDaysInWeek: number;
  studyResults: WeeklyStudyResult[];
  cheatUsed: boolean;
  pass: boolean;
}

/** One ISO week = one "floor" of a run. Pass requires a good average score and clearing any active weekly habit. */
export function computeFloor(
  playerId: string,
  playerLogs: LogRow[],
  habits: Habit[],
  config: ConfigMap,
  mondayDate: string
): FloorResult {
  const days = weekDates(mondayDate);
  const dailyResults = days.map((d) => computeDailyScore(d, playerId, playerLogs, habits, config));
  const scoredDays = dailyResults.filter((r) => r.anyLogged);
  const weeklyScore = scoredDays.length > 0 ? scoredDays.reduce((s, r) => s + r.score, 0) / scoredDays.length : 0;
  const goodDaysInWeek = dailyResults.filter((r) => isGoodDay(r, config)).length;
  const studyResults = computeWeeklyStudy(playerId, playerLogs, habits, mondayDate);
  const noSugarHabit = habits.find((h) => h.type === 'cheatday');
  const cheatUsed = noSugarHabit
    ? playerLogs.some(
        (l) =>
          l.playerId === playerId &&
          l.habitId === noSugarHabit.habitId &&
          weekKey(l.date) === mondayDate &&
          l.value === 2
      )
    : false;
  const studyPass = studyResults.length === 0 || studyResults.every((s) => s.pass);

  return {
    weekStart: mondayDate,
    weeklyScore,
    goodDaysInWeek,
    studyResults,
    cheatUsed,
    pass: weeklyScore >= config.goodDayThreshold && studyPass,
  };
}

export interface Run {
  startWeek: string;
  endWeek: string;
  floors: number;
  ongoing: boolean;
}

export interface RunSummary {
  runs: Run[];
  currentRun: number;
  bestRun: number;
}

/** `floorResults` must be sorted ascending by weekStart and cover every elapsed week. */
export function computeRuns(floorResults: FloorResult[]): RunSummary {
  const runs: Run[] = [];
  let runStart: string | null = null;
  let count = 0;

  floorResults.forEach((floor, i) => {
    if (floor.pass) {
      if (runStart === null) runStart = floor.weekStart;
      count += 1;
    } else {
      if (runStart !== null) {
        runs.push({ startWeek: runStart, endWeek: floorResults[i - 1].weekStart, floors: count, ongoing: false });
      }
      runStart = null;
      count = 0;
    }
  });

  if (runStart !== null) {
    runs.push({
      startWeek: runStart,
      endWeek: floorResults[floorResults.length - 1].weekStart,
      floors: count,
      ongoing: true,
    });
  }

  const last = runs[runs.length - 1];
  const currentRun = last?.ongoing ? last.floors : 0;
  const bestRun = runs.reduce((max, r) => Math.max(max, r.floors), 0);
  return { runs, currentRun, bestRun };
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: 'first_blood', name: 'First Blood', description: 'Complete every active habit in a single day.', icon: '🩸' },
  { id: 'iron_will', name: 'Iron Will', description: 'Reach a 14-day good-day streak.', icon: '🛡️' },
  { id: 'marathoner', name: 'Marathoner', description: 'Reach a 30-day good-day streak.', icon: '🏃' },
  { id: 'early_bird', name: 'Early Bird', description: 'Wake up on time 7 days in a row.', icon: '🌅' },
  { id: 'hydrated', name: 'Hydrated', description: 'Hit your water target 7 days in a row.', icon: '💧' },
  { id: 'unbroken', name: 'Unbroken', description: 'Clear every core habit 7 days in a row.', icon: '⚔️' },
  { id: 'bookworm', name: 'Bookworm', description: 'Hit your reading target on 10 different days.', icon: '📖' },
  { id: 'sweet_victory', name: 'Sweet Victory', description: 'Keep no-sugar for 14 days in a row.', icon: '🍬' },
  { id: 'deep_diver', name: 'Deep Diver', description: 'Hit your dead-hang target 5 days in a row.', icon: '🪢' },
  { id: 'scholar', name: 'Scholar', description: 'Clear a perfect study week (2x the weekly target).', icon: '🎓' },
];

function longestConsecutiveRun(dates: string[], ok: (date: string) => boolean): number {
  let longest = 0;
  let current = 0;
  for (const date of dates) {
    if (ok(date)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

export interface BadgeContext {
  playerId: string;
  playerLogs: LogRow[];
  habits: Habit[];
  config: ConfigMap;
  startDate: string;
  endDate: string;
  longestStreak: number;
}

export function computeEarnedBadges(ctx: BadgeContext): Set<string> {
  const { playerId, playerLogs, habits, config, startDate, endDate, longestStreak } = ctx;
  const dates = daysBetween(startDate, endDate);
  const dailyResults = dates.map((d) => computeDailyScore(d, playerId, playerLogs, habits, config));
  const activeDailyHabits = habits.filter((h) => h.active && h.period === 'daily');

  const earned = new Set<string>();

  const hadPerfectDay = dailyResults.some(
    (r) => r.anyLogged && activeDailyHabits.length > 0 && activeDailyHabits.every((h) => r.perHabit[h.habitId])
  );
  if (hadPerfectDay) earned.add('first_blood');

  if (longestStreak >= 14) earned.add('iron_will');
  if (longestStreak >= 30) earned.add('marathoner');

  const wakeHabit = habits.find((h) => h.habitId === 'wake_time');
  if (wakeHabit && longestConsecutiveRun(dates, (d) => dailyResults[dates.indexOf(d)].perHabit[wakeHabit.habitId]) >= 7) {
    earned.add('early_bird');
  }

  const waterHabit = habits.find((h) => h.habitId === 'water');
  if (waterHabit && longestConsecutiveRun(dates, (d) => dailyResults[dates.indexOf(d)].perHabit[waterHabit.habitId]) >= 7) {
    earned.add('hydrated');
  }

  if (
    activeDailyHabits.some((h) => h.tier === 'core') &&
    longestConsecutiveRun(dates, (d) => dailyResults[dates.indexOf(d)].coreDone) >= 7
  ) {
    earned.add('unbroken');
  }

  const readHabit = habits.find((h) => h.habitId === 'read');
  if (readHabit) {
    const readDays = dailyResults.filter((r) => r.perHabit[readHabit.habitId]).length;
    if (readDays >= 10) earned.add('bookworm');
  }

  const noSugarHabit = habits.find((h) => h.type === 'cheatday');
  if (
    noSugarHabit &&
    longestConsecutiveRun(dates, (d) => dailyResults[dates.indexOf(d)].perHabit[noSugarHabit.habitId]) >= 14
  ) {
    earned.add('sweet_victory');
  }

  const hangHabit = habits.find((h) => h.habitId === 'workout_hang');
  if (hangHabit && longestConsecutiveRun(dates, (d) => dailyResults[dates.indexOf(d)].perHabit[hangHabit.habitId]) >= 5) {
    earned.add('deep_diver');
  }

  const mondays = new Set(dates.map((d) => weekKey(d)));
  for (const monday of mondays) {
    const studyResults = computeWeeklyStudy(playerId, playerLogs, habits, monday);
    if (studyResults.some((s) => s.perfect)) {
      earned.add('scholar');
      break;
    }
  }

  return earned;
}
