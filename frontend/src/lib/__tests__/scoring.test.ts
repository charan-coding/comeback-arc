import { describe, it, expect } from 'vitest';
import { Habit, LogRow, DEFAULT_CONFIG } from '../../api/types';
import {
  computeDailyScore,
  isGoodDay,
  resolveCheatDayDone,
  computeStreaks,
  computeConsistency,
  computeCategoryRates,
  computeWeeklyStudy,
} from '../scoring';
import { DEFAULT_HABITS } from '../habitDefs';

const PLAYER = 'p1';

function makeLog(date: string, habitId: string, value: number): LogRow {
  return { date, playerId: PLAYER, habitId, value, done: false, updatedAt: `${date}T10:00:00Z` };
}

const coreHabits = DEFAULT_HABITS.filter((h) => h.tier === 'core');
const bonusHabits = DEFAULT_HABITS.filter((h) => h.tier === 'bonus');

describe('computeDailyScore', () => {
  it('scores 0 with no logs', () => {
    const r = computeDailyScore('2026-02-01', PLAYER, [], DEFAULT_HABITS, DEFAULT_CONFIG);
    expect(r.score).toBe(0);
    expect(r.anyLogged).toBe(false);
    expect(r.coreDone).toBe(false);
  });

  it('scores 1 when every active daily habit is met', () => {
    const date = '2026-02-01';
    const logs: LogRow[] = DEFAULT_HABITS.filter((h) => h.period === 'daily').map((h) => {
      if (h.type === 'time') return makeLog(date, h.habitId, h.target - 10 >= 0 ? h.target - 10 : h.target);
      if (h.habitId === 'screen_time') return makeLog(date, h.habitId, 1); // under the 4h cap
      return makeLog(date, h.habitId, h.target);
    });
    const r = computeDailyScore(date, PLAYER, logs, DEFAULT_HABITS, DEFAULT_CONFIG);
    expect(r.score).toBeCloseTo(1);
    expect(r.coreDone).toBe(true);
  });

  it('weights core habits more heavily than bonus habits', () => {
    const date = '2026-02-01';
    // Complete every core habit, no bonus habits.
    const logs: LogRow[] = coreHabits
      .filter((h) => h.period === 'daily')
      .map((h) => (h.type === 'time' ? makeLog(date, h.habitId, h.target) : makeLog(date, h.habitId, h.target)));
    const r = computeDailyScore(date, PLAYER, logs, DEFAULT_HABITS, DEFAULT_CONFIG);
    // All core done, all bonus missing -> score should still be well above 0.5 since core carries 2x weight.
    expect(r.coreDone).toBe(true);
    expect(r.score).toBeGreaterThan(0.6);
  });

  it('handles an atMost direction habit (screen time) correctly', () => {
    const date = '2026-02-01';
    const under = computeDailyScore(date, PLAYER, [makeLog(date, 'screen_time', 2)], DEFAULT_HABITS, DEFAULT_CONFIG);
    const over = computeDailyScore(date, PLAYER, [makeLog(date, 'screen_time', 6)], DEFAULT_HABITS, DEFAULT_CONFIG);
    expect(under.perHabit['screen_time']).toBe(true);
    expect(over.perHabit['screen_time']).toBe(false);
  });

  it('handles a time habit with tolerance', () => {
    const toleranceHabits: Habit[] = [
      { habitId: 'bed_time', name: 'Bed', category: 'Discipline', tier: 'core', weight: 1, type: 'time', target: 23 * 60, toleranceMinutes: 15, period: 'daily', active: true },
    ];
    const onTime = computeDailyScore('2026-02-01', PLAYER, [makeLog('2026-02-01', 'bed_time', 23 * 60 + 10)], toleranceHabits, DEFAULT_CONFIG);
    const tooLate = computeDailyScore('2026-02-01', PLAYER, [makeLog('2026-02-01', 'bed_time', 23 * 60 + 20)], toleranceHabits, DEFAULT_CONFIG);
    expect(onTime.perHabit['bed_time']).toBe(true);
    expect(tooLate.perHabit['bed_time']).toBe(false);
  });
});

describe('isGoodDay', () => {
  it('requires both the score threshold and all core habits done', () => {
    expect(isGoodDay({ date: 'd', score: 0.9, coreDone: false, anyLogged: true, perHabit: {} })).toBe(false);
    expect(isGoodDay({ date: 'd', score: 0.5, coreDone: true, anyLogged: true, perHabit: {} })).toBe(false);
    expect(isGoodDay({ date: 'd', score: 0.7, coreDone: true, anyLogged: true, perHabit: {} })).toBe(true);
  });
});

describe('resolveCheatDayDone', () => {
  const habitId = 'no_sugar';
  it('passes a normal kept day', () => {
    const logs = [makeLog('2026-02-02', habitId, 1)];
    expect(resolveCheatDayDone('2026-02-02', logs, 1)).toBe(true);
  });
  it('fails a broken day with no cheat token', () => {
    const logs = [makeLog('2026-02-02', habitId, 0)];
    expect(resolveCheatDayDone('2026-02-02', logs, 1)).toBe(false);
  });
  it('allows exactly one cheat-token usage per week', () => {
    const logs = [makeLog('2026-02-02', habitId, 2)];
    expect(resolveCheatDayDone('2026-02-02', logs, 1)).toBe(true);
  });
  it('fails a second cheat-token usage in the same week', () => {
    const logs = [makeLog('2026-02-02', habitId, 2), makeLog('2026-02-04', habitId, 2)];
    expect(resolveCheatDayDone('2026-02-02', logs, 1)).toBe(true); // first usage, earliest date
    expect(resolveCheatDayDone('2026-02-04', logs, 1)).toBe(false); // second usage fails
  });
});

describe('computeStreaks', () => {
  const minimalHabits: Habit[] = [
    { habitId: 'core1', name: 'Core', category: 'Body', tier: 'core', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true },
  ];
  const config = { ...DEFAULT_CONFIG, restTokensPerWeek: 1 };

  it('builds a streak across consecutive good days', () => {
    const logs = ['2026-02-02', '2026-02-03', '2026-02-04'].map((d) => makeLog(d, 'core1', 1));
    const r = computeStreaks(PLAYER, logs, minimalHabits, config, '2026-02-02', '2026-02-04');
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
  });

  it('breaks the streak on a bad day once the rest token is spent', () => {
    // Mon-Sun week of 2026-02-02..08. Day 3 (02-04) is bad, protected by 1 rest token. Day 6 (02-07) is also bad -> breaks.
    const goodDates = ['2026-02-02', '2026-02-03', '2026-02-05', '2026-02-06', '2026-02-08'];
    const logs = goodDates.map((d) => makeLog(d, 'core1', 1));
    const r = computeStreaks(PLAYER, logs, minimalHabits, config, '2026-02-02', '2026-02-08');
    // 02-02 good(1) 02-03 good(2) 02-04 bad->rest token used, streak holds at 2
    // 02-05 good(3) 02-06 good(4) 02-07 bad-> no tokens left this week -> reset to 0
    // 02-08 good(1)
    expect(r.current).toBe(1);
    expect(r.longest).toBe(4);
  });
});

describe('computeConsistency (fair for later joiners)', () => {
  const minimalHabits: Habit[] = [
    { habitId: 'core1', name: 'Core', category: 'Body', tier: 'core', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true },
  ];

  it('clips the window to the player start date instead of penalizing a new joiner', () => {
    // Player joined 2026-02-05, only 2 days of history exist, both good.
    const logs = ['2026-02-05', '2026-02-06'].map((d) => makeLog(d, 'core1', 1));
    const r = computeConsistency(PLAYER, logs, minimalHabits, DEFAULT_CONFIG, 30, '2026-02-06', '2026-02-05');
    expect(r.totalDays).toBe(2); // not 30
    expect(r.goodDays).toBe(2);
    expect(r.consistencyRate).toBe(1);
  });

  it('uses the full window once the player has enough history', () => {
    const dates = ['2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11', '2026-01-12', '2026-01-13', '2026-01-14'];
    const logs = dates.map((d) => makeLog(d, 'core1', 1));
    const r = computeConsistency(PLAYER, logs, minimalHabits, DEFAULT_CONFIG, 7, '2026-01-14', '2025-12-01');
    expect(r.totalDays).toBe(7);
    expect(r.goodDays).toBe(7);
  });
});

describe('computeCategoryRates', () => {
  it('splits completion rates per category', () => {
    const habits: Habit[] = [
      { habitId: 'body1', name: 'Body', category: 'Body', tier: 'core', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true },
      { habitId: 'fuel1', name: 'Fuel', category: 'Fuel', tier: 'bonus', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true },
    ];
    const logs = [makeLog('2026-02-01', 'body1', 1)]; // fuel1 not logged
    const r = computeCategoryRates(PLAYER, logs, habits, DEFAULT_CONFIG, '2026-02-01', '2026-02-01');
    expect(r.Body.rate).toBe(1);
    expect(r.Fuel.rate).toBe(0);
  });
});

describe('computeWeeklyStudy', () => {
  it('sums hours Mon-Sun and flags pass/perfect thresholds', () => {
    const logs = [
      makeLog('2026-01-12', 'study', 1),
      makeLog('2026-01-13', 'study', 1),
      makeLog('2026-01-14', 'study', 1),
      makeLog('2026-01-15', 'study', 1),
    ];
    const r = computeWeeklyStudy(PLAYER, logs, DEFAULT_HABITS, '2026-01-12');
    const study = r.find((x) => x.habitId === 'study')!;
    expect(study.totalHours).toBe(4);
    expect(study.pass).toBe(true);
    expect(study.perfect).toBe(false);
  });

  it('marks perfect once hours reach double the pass target', () => {
    const dates = ['2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15', '2026-01-16', '2026-01-17', '2026-01-18'];
    const logs = dates.map((d) => makeLog(d, 'study', 2)); // 14h total, well above 8h
    const r = computeWeeklyStudy(PLAYER, logs, DEFAULT_HABITS, '2026-01-12');
    const study = r.find((x) => x.habitId === 'study')!;
    expect(study.perfect).toBe(true);
  });
});

void bonusHabits;
