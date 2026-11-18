import { describe, it, expect } from 'vitest';
import { Habit, LogRow, DEFAULT_CONFIG } from '../../api/types';
import {
  xpForLevel,
  levelFromXp,
  classTitle,
  computeFloor,
  computeRuns,
  computeEarnedBadges,
  totalXp,
} from '../rpg';
import { DEFAULT_HABITS } from '../habitDefs';

const PLAYER = 'p1';

function makeLog(date: string, habitId: string, value: number): LogRow {
  return { date, playerId: PLAYER, habitId, value, done: false, updatedAt: `${date}T10:00:00Z` };
}

const minimalHabits: Habit[] = [
  { habitId: 'core1', name: 'Core', category: 'Body', tier: 'core', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true },
  { habitId: 'bonus1', name: 'Bonus', category: 'Mind', tier: 'bonus', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true },
];

describe('xpForLevel / levelFromXp', () => {
  it('requires 0 xp for level 1', () => {
    expect(xpForLevel(1)).toBe(0);
  });
  it('is monotonically increasing', () => {
    expect(xpForLevel(5)).toBeGreaterThan(xpForLevel(4));
    expect(xpForLevel(10)).toBeGreaterThan(xpForLevel(5));
  });
  it('round-trips through levelFromXp', () => {
    const xp = xpForLevel(6);
    expect(levelFromXp(xp).level).toBe(6);
    expect(levelFromXp(xp - 1).level).toBe(5);
  });
});

describe('classTitle', () => {
  it('tiers titles by level', () => {
    expect(classTitle('Ranger', 1)).toBe('Novice Ranger');
    expect(classTitle('Ranger', 5)).toBe('Ranger');
    expect(classTitle('Ranger', 10)).toBe('Veteran Ranger');
    expect(classTitle('Ranger', 20)).toBe('Legendary Ranger');
  });
});

describe('totalXp', () => {
  it('awards more for core habits and a good-day bonus', () => {
    const logs = [makeLog('2026-02-01', 'core1', 1), makeLog('2026-02-01', 'bonus1', 1)];
    const xp = totalXp(PLAYER, logs, minimalHabits, DEFAULT_CONFIG, '2026-02-01', '2026-02-01');
    // core(15) + bonus(10) + good-day bonus(20) = 45
    expect(xp).toBe(45);
  });
});

describe('computeFloor', () => {
  it('passes the week when the average score clears the threshold and study passes', () => {
    const days = ['2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15', '2026-01-16', '2026-01-17', '2026-01-18'];
    const logs: LogRow[] = [];
    for (const d of days) {
      logs.push(makeLog(d, 'core1', 1));
      logs.push(makeLog(d, 'study', 1)); // 7h total, clears the 4h pass target
    }
    const habits = [minimalHabits[0], DEFAULT_HABITS.find((h) => h.habitId === 'study')!];
    const floor = computeFloor(PLAYER, logs, habits, DEFAULT_CONFIG, '2026-01-12');
    expect(floor.pass).toBe(true);
    expect(floor.weeklyScore).toBeCloseTo(1); // core1 (the only daily habit) done every day
  });

  it('fails the week when the study habit misses its target', () => {
    const days = ['2026-01-12', '2026-01-13'];
    const logs: LogRow[] = days.map((d) => makeLog(d, 'study', 1)); // only 2h, below 4h pass target
    const habits = [DEFAULT_HABITS.find((h) => h.habitId === 'study')!];
    const floor = computeFloor(PLAYER, logs, habits, DEFAULT_CONFIG, '2026-01-12');
    expect(floor.pass).toBe(false);
  });
});

describe('computeRuns', () => {
  it('tracks the current ongoing run and the best historical run', () => {
    const floors = [
      { weekStart: 'w1', weeklyScore: 1, goodDaysInWeek: 7, studyResults: [], cheatUsed: false, pass: true },
      { weekStart: 'w2', weeklyScore: 1, goodDaysInWeek: 7, studyResults: [], cheatUsed: false, pass: true },
      { weekStart: 'w3', weeklyScore: 0, goodDaysInWeek: 0, studyResults: [], cheatUsed: false, pass: false },
      { weekStart: 'w4', weeklyScore: 1, goodDaysInWeek: 7, studyResults: [], cheatUsed: false, pass: true },
    ];
    const summary = computeRuns(floors);
    expect(summary.bestRun).toBe(2); // w1-w2
    expect(summary.currentRun).toBe(1); // w4, ongoing
    expect(summary.runs).toHaveLength(2);
    expect(summary.runs[1].ongoing).toBe(true);
  });

  it('reports no current run right after a failed floor', () => {
    const floors = [
      { weekStart: 'w1', weeklyScore: 1, goodDaysInWeek: 7, studyResults: [], cheatUsed: false, pass: true },
      { weekStart: 'w2', weeklyScore: 0, goodDaysInWeek: 0, studyResults: [], cheatUsed: false, pass: false },
    ];
    const summary = computeRuns(floors);
    expect(summary.currentRun).toBe(0);
    expect(summary.bestRun).toBe(1);
  });
});

describe('computeEarnedBadges', () => {
  it('awards First Blood for a perfect day', () => {
    const habits = [minimalHabits[0]];
    const logs = [makeLog('2026-02-01', 'core1', 1)];
    const earned = computeEarnedBadges({
      playerId: PLAYER,
      playerLogs: logs,
      habits,
      config: DEFAULT_CONFIG,
      startDate: '2026-02-01',
      endDate: '2026-02-01',
      longestStreak: 1,
    });
    expect(earned.has('first_blood')).toBe(true);
  });

  it('awards Iron Will / Marathoner from streak length alone', () => {
    const earned14 = computeEarnedBadges({
      playerId: PLAYER,
      playerLogs: [],
      habits: [],
      config: DEFAULT_CONFIG,
      startDate: '2026-02-01',
      endDate: '2026-02-01',
      longestStreak: 14,
    });
    expect(earned14.has('iron_will')).toBe(true);
    expect(earned14.has('marathoner')).toBe(false);

    const earned30 = computeEarnedBadges({
      playerId: PLAYER,
      playerLogs: [],
      habits: [],
      config: DEFAULT_CONFIG,
      startDate: '2026-02-01',
      endDate: '2026-02-01',
      longestStreak: 30,
    });
    expect(earned30.has('marathoner')).toBe(true);
  });

  it('awards Early Bird after 7 consecutive on-time wakeups', () => {
    const wakeHabit = DEFAULT_HABITS.find((h) => h.habitId === 'wake_time')!;
    const days = ['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04', '2026-02-05', '2026-02-06', '2026-02-07'];
    const logs = days.map((d) => makeLog(d, 'wake_time', wakeHabit.target - 10));
    const earned = computeEarnedBadges({
      playerId: PLAYER,
      playerLogs: logs,
      habits: [wakeHabit],
      config: DEFAULT_CONFIG,
      startDate: days[0],
      endDate: days[6],
      longestStreak: 0,
    });
    expect(earned.has('early_bird')).toBe(true);
  });

  it('does not award Early Bird if the streak is broken partway', () => {
    const wakeHabit = DEFAULT_HABITS.find((h) => h.habitId === 'wake_time')!;
    const days = ['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04', '2026-02-05', '2026-02-06', '2026-02-07'];
    const logs = days
      .filter((d) => d !== '2026-02-04')
      .map((d) => makeLog(d, 'wake_time', wakeHabit.target - 10));
    const earned = computeEarnedBadges({
      playerId: PLAYER,
      playerLogs: logs,
      habits: [wakeHabit],
      config: DEFAULT_CONFIG,
      startDate: days[0],
      endDate: days[6],
      longestStreak: 0,
    });
    expect(earned.has('early_bird')).toBe(false);
  });
});
