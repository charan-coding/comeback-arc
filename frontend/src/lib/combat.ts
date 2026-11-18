import { Habit, LogRow, ConfigMap, Player } from '../api/types';
import { daysBetween } from './day';
import { computeDailyScore } from './scoring';

/**
 * Daily Boss Fight: every completed habit earns a relic, every habit left undone by
 * rollover gives a curse. Everyone with an account fights everyone else in a
 * free-for-all using that day's relics/curses; last one standing wins. Pure and
 * deterministic (no randomness anywhere), built entirely from data the app already
 * has — see lib/__tests__/combat.test.ts.
 */

export type CurseType = 'vulnerable' | 'weak';

export interface Relic {
  habitId: string;
  name: string;
  damage: number;
}

export interface Curse {
  habitId: string;
  name: string;
  type: CurseType;
  percent: number;
}

/** Flavor names only — the numeric effect depends solely on the habit's tier (core/bonus). Original names, no copyrighted IP. */
const RELIC_NAMES: Record<string, string> = {
  workout_pushups: 'Iron Knuckles',
  workout_squats: 'Stonelegs Greaves',
  workout_crunches: 'Core of Steel',
  workout_hang: 'Grip of the Ancients',
  workout_cardio: "Windrunner's Charm",
  read: 'Tome of Clarity',
  bed_time: 'Moonlit Pillow',
  wake_time: "Rooster's Crown",
  meals_cooked: 'Hearth Ember',
  meds: "Alchemist's Vial",
  protein: 'Beast Fang',
  creatine: 'Power Crystal',
  screen_time: "Owl's Focus",
  no_sugar: 'Willpower Idol',
  portion_control: 'Moderation Charm',
  water: 'Tidebound Flask',
  fasting: 'Empty Bowl Relic',
};

const CURSE_NAME_CACHE: Record<string, string> = {
  'vulnerable-10': 'Cracked Armor',
  'vulnerable-20': 'Shattered Armor',
  'weak-10': 'Fading Resolve',
  'weak-20': 'Broken Resolve',
};

const CURSE_PERCENT_CAP = 80;

function curseFor(habit: Habit): Pick<Curse, 'type' | 'percent' | 'name'> {
  const type: CurseType = habit.category === 'Body' || habit.category === 'Fuel' ? 'vulnerable' : 'weak';
  const percent = habit.tier === 'core' ? 20 : 10;
  return { type, percent, name: CURSE_NAME_CACHE[`${type}-${percent}`] };
}

export interface DailyLoadout {
  playerId: string;
  date: string;
  relics: Relic[];
  curses: Curse[];
  weakPercent: number;
  vulnerablePercent: number;
  baseAttack: number;
  attack: number;
}

/** Derives one player's relics/curses/attack for a single logical date from their existing log/habit data. */
export function getDailyLoadout(date: string, playerId: string, playerLogs: LogRow[], habits: Habit[], config: ConfigMap): DailyLoadout {
  const dailyHabits = habits.filter((h) => h.active && h.period === 'daily');
  const result = computeDailyScore(date, playerId, playerLogs, habits, config);

  const relics: Relic[] = [];
  const curses: Curse[] = [];

  for (const habit of dailyHabits) {
    if (result.perHabit[habit.habitId]) {
      relics.push({
        habitId: habit.habitId,
        name: RELIC_NAMES[habit.habitId] ?? habit.name,
        damage: habit.tier === 'core' ? 2 : 1,
      });
    } else {
      const c = curseFor(habit);
      curses.push({ habitId: habit.habitId, name: c.name, type: c.type, percent: c.percent });
    }
  }

  const weakPercent = Math.min(
    CURSE_PERCENT_CAP,
    curses.filter((c) => c.type === 'weak').reduce((sum, c) => sum + c.percent, 0)
  );
  const vulnerablePercent = Math.min(
    CURSE_PERCENT_CAP,
    curses.filter((c) => c.type === 'vulnerable').reduce((sum, c) => sum + c.percent, 0)
  );
  const baseAttack = relics.reduce((sum, r) => sum + r.damage, 0);
  const attack = baseAttack * (1 - weakPercent / 100);

  return { playerId, date, relics, curses, weakPercent, vulnerablePercent, baseAttack, attack };
}

export interface Fighter {
  playerId: string;
  name: string;
  maxHp: number;
  hp: number;
  attack: number;
  vulnerablePercent: number;
  relics: Relic[];
  curses: Curse[];
}

export function toFighter(playerId: string, name: string, loadout: DailyLoadout, level: number): Fighter {
  const maxHp = 20 + level;
  return {
    playerId,
    name,
    maxHp,
    hp: maxHp,
    attack: loadout.attack,
    vulnerablePercent: loadout.vulnerablePercent,
    relics: loadout.relics,
    curses: loadout.curses,
  };
}

export interface RoundLog {
  round: number;
  damageDealt: Record<string, number>;
  hpAfter: Record<string, number>;
  eliminated: string[];
  events: string[];
}

export interface BossFightResult {
  rounds: RoundLog[];
  winnerId: string | null;
  survivorIds: string[];
}

const MAX_ROUNDS = 20;
export const CRIT_CHANCE = 0.15;
export const CRIT_MULTIPLIER = 1.5;
export const DODGE_CHANCE = 0.1;

/**
 * Round-based, simultaneous N-player free-for-all: every living fighter damages every
 * other living fighter at once each round (so turn order never matters), until ≤1
 * remain. A simultaneous full wipe is broken by smallest overkill (closest to
 * surviving). A round-cap stalemate (e.g. everyone at 0 attack) is a draw.
 *
 * `rng`, if given, adds a little swing (a dodge, a crit) purely for flavor/"dopamine" —
 * pass none (the default) for the original fully deterministic behavior, which is what
 * every existing test below exercises; real gameplay passes a per-day seeded RNG
 * (`lib/rng.ts`'s `dailyRng`) so the swing is stable across reloads of the same day.
 */
export function simulateBossFight(fighters: Fighter[], rng?: () => number): BossFightResult {
  if (fighters.length === 0) return { rounds: [], winnerId: null, survivorIds: [] };
  if (fighters.length === 1) return { rounds: [], winnerId: fighters[0].playerId, survivorIds: [fighters[0].playerId] };

  const hp = new Map(fighters.map((f) => [f.playerId, f.hp]));
  const byId = new Map(fighters.map((f) => [f.playerId, f]));
  let alive = fighters.map((f) => f.playerId);
  const rounds: RoundLog[] = [];

  for (let round = 1; round <= MAX_ROUNDS && alive.length > 1; round += 1) {
    const damage: Record<string, number> = {};
    const events: string[] = [];
    for (const id of alive) damage[id] = 0;

    for (const attackerId of alive) {
      const attacker = byId.get(attackerId)!;
      for (const defenderId of alive) {
        if (defenderId === attackerId) continue;
        const defender = byId.get(defenderId)!;
        if (rng && rng() < DODGE_CHANCE) {
          events.push(`${defender.name} dodged ${attacker.name}'s strike!`);
          continue;
        }
        let dmg = attacker.attack * (1 + defender.vulnerablePercent / 100);
        if (rng && rng() < CRIT_CHANCE) {
          dmg *= CRIT_MULTIPLIER;
          events.push(`${attacker.name} landed a critical hit on ${defender.name}!`);
        }
        damage[defenderId] += dmg;
      }
    }

    const hpAfter: Record<string, number> = {};
    const eliminated: string[] = [];
    for (const id of alive) {
      const newHp = (hp.get(id) ?? 0) - damage[id];
      hp.set(id, newHp);
      hpAfter[id] = newHp;
      if (newHp <= 0) eliminated.push(id);
    }
    rounds.push({ round, damageDealt: damage, hpAfter, eliminated, events });

    if (eliminated.length === alive.length) {
      let bestId = eliminated[0];
      for (const id of eliminated) if (hpAfter[id] > hpAfter[bestId]) bestId = id;
      return { rounds, winnerId: bestId, survivorIds: [] };
    }
    const eliminatedSet = new Set(eliminated);
    alive = alive.filter((id) => !eliminatedSet.has(id));
  }

  if (alive.length === 1) {
    return { rounds, winnerId: alive[0], survivorIds: alive };
  }
  return { rounds, winnerId: null, survivorIds: alive };
}

export interface BossFightRecord {
  wins: number;
  losses: number;
  draws: number;
}

/** Replays every day in [fromDate, toDate] to build a running win/loss/draw record per player. */
export function computeBossFightHistory(
  players: Player[],
  logsByPlayer: Record<string, LogRow[]>,
  habitsByPlayer: Record<string, Habit[]>,
  levelByPlayer: Record<string, number>,
  config: ConfigMap,
  fromDate: string,
  toDate: string
): Record<string, BossFightRecord> {
  const record: Record<string, BossFightRecord> = {};
  for (const p of players) record[p.playerId] = { wins: 0, losses: 0, draws: 0 };

  for (const date of daysBetween(fromDate, toDate)) {
    const participants = players.filter((p) => p.createdAt <= date);
    if (participants.length < 2) continue;

    const fighters = participants.map((p) =>
      toFighter(
        p.playerId,
        p.name,
        getDailyLoadout(date, p.playerId, logsByPlayer[p.playerId] ?? [], habitsByPlayer[p.playerId] ?? [], config),
        levelByPlayer[p.playerId] ?? 1
      )
    );
    const result = simulateBossFight(fighters);

    for (const p of participants) {
      if (result.winnerId === null) record[p.playerId].draws += 1;
      else if (result.winnerId === p.playerId) record[p.playerId].wins += 1;
      else record[p.playerId].losses += 1;
    }
  }

  return record;
}
