import { describe, it, expect } from 'vitest';
import { Habit, LogRow, Player, DEFAULT_CONFIG } from '../../api/types';
import { getDailyLoadout, simulateBossFight, computeBossFightHistory, Fighter } from '../combat';

const PLAYER = 'p1';
const DATE = '2026-02-01';

function makeLog(habitId: string, value: number, date = DATE, playerId = PLAYER): LogRow {
  return { date, playerId, habitId, value, done: false, updatedAt: `${date}T10:00:00Z` };
}

const coreBody: Habit = { habitId: 'core_body', name: 'Core Body', category: 'Body', tier: 'core', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true };
const bonusMind: Habit = { habitId: 'bonus_mind', name: 'Bonus Mind', category: 'Mind', tier: 'bonus', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true };
const bonusFuel: Habit = { habitId: 'bonus_fuel', name: 'Bonus Fuel', category: 'Fuel', tier: 'bonus', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true };
const coreDiscipline: Habit = { habitId: 'core_discipline', name: 'Core Discipline', category: 'Discipline', tier: 'core', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true };

describe('getDailyLoadout', () => {
  it('awards a 2-damage relic for a completed core habit', () => {
    const loadout = getDailyLoadout(DATE, PLAYER, [makeLog('core_body', 1)], [coreBody], DEFAULT_CONFIG);
    expect(loadout.relics).toHaveLength(1);
    expect(loadout.relics[0].habitId).toBe('core_body');
    expect(loadout.relics[0].damage).toBe(2);
    expect(typeof loadout.relics[0].name).toBe('string');
  });

  it('awards a 1-damage relic for a completed bonus habit', () => {
    const loadout = getDailyLoadout(DATE, PLAYER, [makeLog('bonus_mind', 1)], [bonusMind], DEFAULT_CONFIG);
    expect(loadout.relics[0].damage).toBe(1);
  });

  it('gives Vulnerable for an incomplete Body/Fuel habit, Weak for Mind/Discipline', () => {
    const loadout = getDailyLoadout(DATE, PLAYER, [], [coreBody, bonusMind, bonusFuel, coreDiscipline], DEFAULT_CONFIG);
    const byHabit = Object.fromEntries(loadout.curses.map((c) => [c.habitId, c]));
    expect(byHabit.core_body.type).toBe('vulnerable');
    expect(byHabit.bonus_fuel.type).toBe('vulnerable');
    expect(byHabit.bonus_mind.type).toBe('weak');
    expect(byHabit.core_discipline.type).toBe('weak');
  });

  it('gives Major (20%) curses for core habits, Minor (10%) for bonus', () => {
    const loadout = getDailyLoadout(DATE, PLAYER, [], [coreBody, bonusMind], DEFAULT_CONFIG);
    const byHabit = Object.fromEntries(loadout.curses.map((c) => [c.habitId, c]));
    expect(byHabit.core_body.percent).toBe(20);
    expect(byHabit.bonus_mind.percent).toBe(10);
  });

  it('reduces attack by the aggregate Weak percent', () => {
    // core_body done (2 dmg relic), bonus_mind undone (Weak 10%)
    const loadout = getDailyLoadout(DATE, PLAYER, [makeLog('core_body', 1)], [coreBody, bonusMind], DEFAULT_CONFIG);
    expect(loadout.baseAttack).toBe(2);
    expect(loadout.weakPercent).toBe(10);
    expect(loadout.attack).toBeCloseTo(1.8);
  });

  it('caps stacked curse percentages at 80%', () => {
    const manyBonusMind: Habit[] = Array.from({ length: 10 }, (_, i) => ({ ...bonusMind, habitId: `bm${i}` }));
    const loadout = getDailyLoadout(DATE, PLAYER, [], manyBonusMind, DEFAULT_CONFIG);
    expect(loadout.weakPercent).toBe(80);
  });
});

function fighter(id: string, hp: number, attack: number, vulnerablePercent = 0): Fighter {
  return { playerId: id, name: id, maxHp: hp, hp, attack, vulnerablePercent, relics: [], curses: [] };
}

describe('simulateBossFight', () => {
  it('resolves a 3-player free-for-all to a single deterministic winner', () => {
    // A deals 3 to each of B,C per round (takes 1+1=2/round); B and C each deal 1 (take 3+1=4/round).
    // Round 1: A=8, B=6, C=6. Round 2: A=6, B=2, C=2. Round 3: A=4, B=-2(dead), C=-2(dead).
    const result = simulateBossFight([fighter('A', 10, 3), fighter('B', 10, 1), fighter('C', 10, 1)]);
    expect(result.winnerId).toBe('A');
    expect(result.survivorIds).toEqual(['A']);
    expect(result.rounds).toHaveLength(3);
  });

  it('breaks a simultaneous mutual KO by the smallest overkill', () => {
    // Round 1: A (hp10) takes 12 -> -2. B (hp11) takes 12 -> -1. Both die same round; B is closer to surviving.
    const result = simulateBossFight([fighter('A', 10, 12), fighter('B', 11, 12)]);
    expect(result.winnerId).toBe('B');
    expect(result.survivorIds).toEqual([]);
  });

  it('declares a draw when nobody can deal damage (round cap reached)', () => {
    const result = simulateBossFight([fighter('A', 10, 0), fighter('B', 10, 0)]);
    expect(result.winnerId).toBeNull();
    expect(result.survivorIds.sort()).toEqual(['A', 'B']);
  });

  it('returns the lone fighter as the winner with no rounds needed', () => {
    const result = simulateBossFight([fighter('A', 10, 5)]);
    expect(result.winnerId).toBe('A');
    expect(result.rounds).toHaveLength(0);
  });
});

describe('computeBossFightHistory', () => {
  it('tallies one win and one loss per day for a 2-player history', () => {
    const players: Player[] = [
      { playerId: 'A', name: 'A', class: 'Fighter', passHash: '', createdAt: '2026-02-01' },
      { playerId: 'B', name: 'B', class: 'Rogue', passHash: '', createdAt: '2026-02-01' },
    ];
    // A completes the core habit (strong relic) every day; B never logs anything (all curses).
    const logsByPlayer: Record<string, LogRow[]> = {
      A: ['2026-02-01', '2026-02-02'].map((d) => makeLog('core_body', 1, d, 'A')),
      B: [],
    };
    const habitsByPlayer = { A: [coreBody], B: [coreBody] };
    const record = computeBossFightHistory(players, logsByPlayer, habitsByPlayer, { A: 1, B: 1 }, DEFAULT_CONFIG, '2026-02-01', '2026-02-02');
    expect(record.A.wins).toBe(2);
    expect(record.B.losses).toBe(2);
  });

  it('skips days before a player has an account', () => {
    const players: Player[] = [
      { playerId: 'A', name: 'A', class: 'Fighter', passHash: '', createdAt: '2026-02-01' },
      { playerId: 'B', name: 'B', class: 'Rogue', passHash: '', createdAt: '2026-02-03' },
    ];
    const record = computeBossFightHistory(players, { A: [], B: [] }, { A: [coreBody], B: [coreBody] }, {}, DEFAULT_CONFIG, '2026-02-01', '2026-02-02');
    // Only one participant existed on each of these days, so no fight happens at all.
    expect(record.A).toEqual({ wins: 0, losses: 0, draws: 0 });
    expect(record.B).toEqual({ wins: 0, losses: 0, draws: 0 });
  });
});
