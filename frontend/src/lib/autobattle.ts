import { Habit, LogRow, ConfigMap } from '../api/types';
import { addDays } from './day';
import { computeDailyScore, isGoodDay, computeStreaks } from './scoring';
import { getDailyLoadout, DailyLoadout } from './combat';

/**
 * The PvE "campaign": an auto-battler ladder that advances one floor for every
 * consecutive good day (reusing the already-tested good-day streak from scoring.ts —
 * no new persisted state needed, it's just "how far your current streak reaches").
 * A miss doesn't necessarily mean nothing happens: a small RNG roll (scaled by how much
 * attack your partial relics still gave you) can still land a consolation hit, so an
 * off day isn't always a total blank — "dopamine even when we don't finish."
 */

export interface Enemy {
  name: string;
  hp: number;
  attack: number;
}

const ENEMY_NAMES = [
  'Sluggish Shade',
  'Couch Wraith',
  'Doomscroll Imp',
  'Snooze Golem',
  'Excuse Sprite',
  'Procrastination Hound',
  'Burnout Wisp',
  'Inertia Ogre',
  'Comfort Zone Dragon',
  'Midnight Scroller',
  'Rust Knight',
  'Echo of Yesterday',
];

const TIER_PREFIXES = ['', 'Greater ', 'Elite ', 'Ascended ', 'Mythic '];

/** `floorIndex` is 0-based: floor 0 is the first enemy you ever face. */
export function enemyAt(floorIndex: number): Enemy {
  const safeIndex = Math.max(0, floorIndex);
  const tier = Math.min(Math.floor(safeIndex / ENEMY_NAMES.length), TIER_PREFIXES.length - 1);
  const name = ENEMY_NAMES[safeIndex % ENEMY_NAMES.length];
  return {
    name: `${TIER_PREFIXES[tier]}${name}`,
    hp: 8 + safeIndex * 3,
    attack: 1 + Math.floor(safeIndex / 2),
  };
}

export type CampaignOutcome = 'victory' | 'consolation' | 'defeat' | 'no-data';

export interface CampaignState {
  date: string;
  floorIndex: number;
  enemy: Enemy;
  loadout: DailyLoadout;
  good: boolean;
  outcome: CampaignOutcome;
  hitChance: number;
  streakAfter: number;
  bestStreak: number;
}

export function computeCampaignState(
  date: string,
  playerId: string,
  playerLogs: LogRow[],
  habits: Habit[],
  config: ConfigMap,
  startDate: string,
  rng: () => number
): CampaignState {
  const yesterday = addDays(date, -1);
  const priorStreak = computeStreaks(playerId, playerLogs, habits, config, startDate, yesterday).current;
  const floorIndex = priorStreak;
  const enemy = enemyAt(floorIndex);

  const loadout = getDailyLoadout(date, playerId, playerLogs, habits, config);
  const dailyResult = computeDailyScore(date, playerId, playerLogs, habits, config);
  const good = isGoodDay(dailyResult, config);

  let outcome: CampaignOutcome;
  let hitChance = 0;
  if (!dailyResult.anyLogged) {
    outcome = 'no-data';
  } else if (good) {
    outcome = 'victory';
  } else {
    hitChance = Math.min(0.6, loadout.attack / Math.max(1, enemy.hp) + 0.15);
    outcome = rng() < hitChance ? 'consolation' : 'defeat';
  }

  const streaksAfter = computeStreaks(playerId, playerLogs, habits, config, startDate, date);

  return {
    date,
    floorIndex,
    enemy,
    loadout,
    good,
    outcome,
    hitChance,
    streakAfter: streaksAfter.current,
    bestStreak: streaksAfter.longest,
  };
}
