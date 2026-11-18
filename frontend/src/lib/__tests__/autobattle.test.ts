import { describe, it, expect } from 'vitest';
import { Habit, LogRow, DEFAULT_CONFIG } from '../../api/types';
import { enemyAt, computeCampaignState } from '../autobattle';

const PLAYER = 'p1';
const START = '2026-02-01';

function makeLog(date: string, habitId: string, value: number): LogRow {
  return { date, playerId: PLAYER, habitId, value, done: false, updatedAt: `${date}T10:00:00Z` };
}

const coreHabit: Habit = { habitId: 'core1', name: 'Core', category: 'Body', tier: 'core', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true };

describe('enemyAt', () => {
  it('has no tier prefix on the first lap through the ladder', () => {
    expect(enemyAt(0).name).toBe('Sluggish Shade');
  });

  it('adds a tier prefix and keeps scaling hp/attack on later laps', () => {
    const first = enemyAt(0);
    const secondLap = enemyAt(12); // 12 names in the ladder, so index 12 wraps to the same name, one tier up
    expect(secondLap.name).toBe('Greater Sluggish Shade');
    expect(secondLap.hp).toBeGreaterThan(first.hp);
    expect(secondLap.attack).toBeGreaterThanOrEqual(first.attack);
  });
});

describe('computeCampaignState', () => {
  it('is a victory on a good day, at the floor matching the prior streak', () => {
    // Three prior good days (streak=3 walking into today), then today is good too.
    const dates = ['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04'];
    const logs = dates.map((d) => makeLog(d, 'core1', 1));
    const state = computeCampaignState('2026-02-04', PLAYER, logs, [coreHabit], DEFAULT_CONFIG, START, () => 0.5);
    expect(state.floorIndex).toBe(3);
    expect(state.outcome).toBe('victory');
  });

  it('rolls a consolation hit on a bad day when the rng favors the player', () => {
    const state = computeCampaignState('2026-02-01', PLAYER, [], [coreHabit], DEFAULT_CONFIG, START, () => 0);
    // no logs at all -> 'no-data', not a combat roll; use a habit that IS logged but fails the target instead.
    expect(state.outcome).toBe('no-data');

    const partial = [makeLog('2026-02-01', 'core1', 0)]; // logged but not done -> not a good day, but anyLogged=true
    const consolation = computeCampaignState('2026-02-01', PLAYER, partial, [coreHabit], DEFAULT_CONFIG, START, () => 0);
    expect(consolation.good).toBe(false);
    expect(consolation.outcome).toBe('consolation');
    void state;
  });

  it('is a defeat on a bad day when the rng is unfavorable', () => {
    const partial = [makeLog('2026-02-01', 'core1', 0)];
    const state = computeCampaignState('2026-02-01', PLAYER, partial, [coreHabit], DEFAULT_CONFIG, START, () => 0.999);
    expect(state.outcome).toBe('defeat');
  });

  it('reports no-data when nothing was logged that day at all', () => {
    const state = computeCampaignState('2026-02-01', PLAYER, [], [coreHabit], DEFAULT_CONFIG, START, () => 0.5);
    expect(state.outcome).toBe('no-data');
  });
});
