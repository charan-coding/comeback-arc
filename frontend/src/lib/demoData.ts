import { Player, LogRow, Habit, ConfigMap, DEFAULT_CONFIG } from '../api/types';
import { DEFAULT_HABITS } from './habitDefs';
import { today, addDays, weekKey } from './day';

/** Small deterministic PRNG so demo data looks the same on every load. */
function mulberry32(seed: number) {
  let s = seed;
  return function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoPlayerSpec {
  playerId: string;
  name: string;
  class: string;
  startOffset: number; // days before the end of the window that this player joined
  consistencyAt: (dayIndex: number, totalDays: number) => number; // 0..1 probability of hitting a given habit
}

const PLAYER_SPECS: DemoPlayerSpec[] = [
  {
    playerId: 'demo_kael',
    name: 'Kael',
    class: 'Paladin',
    startOffset: 60,
    consistencyAt: () => 0.85,
  },
  {
    playerId: 'demo_riya',
    name: 'Riya',
    class: 'Rogue',
    startOffset: 60,
    consistencyAt: (i) => 0.5 + 0.2 * Math.sin(i / 6), // streaky ups and downs
  },
  {
    playerId: 'demo_dev',
    name: 'Dev',
    class: 'Wizard',
    startOffset: 60,
    consistencyAt: (i, total) => 0.25 + 0.5 * (i / total), // the actual "comeback arc"
  },
  {
    playerId: 'demo_ana',
    name: 'Ana',
    class: 'Ranger',
    startOffset: 20, // joined partway through — exercises fair, start-date-aware consistency
    consistencyAt: () => 0.7,
  },
];

function rollValue(habit: Habit, pass: boolean, rng: () => number): number {
  const direction = habit.direction ?? 'atLeast';
  switch (habit.type) {
    case 'checkbox':
    case 'checklist':
      return pass ? 1 : 0;
    case 'count':
      return pass ? habit.target : Math.floor(rng() * habit.target);
    case 'time': {
      const jitter = Math.round(5 + rng() * 55);
      return pass ? Math.max(0, habit.target - jitter) : habit.target + jitter;
    }
    case 'hours': {
      let raw: number;
      if (direction === 'atMost') {
        raw = pass ? habit.target * (0.3 + rng() * 0.5) : habit.target * (1.1 + rng() * 0.6);
      } else {
        // study: scaled down to a per-day share, randomized around the pass/fail line
        raw = pass ? (habit.target / 7) * (1 + rng() * 1.2) : (habit.target / 7) * rng() * 0.6;
      }
      return Math.round(raw * 10) / 10;
    }
    case 'litres': {
      const raw = pass ? habit.target * (1 + rng() * 0.3) : habit.target * (0.3 + rng() * 0.55);
      return Math.round(raw * 100) / 100;
    }
    default: {
      // counter / duration / minutes / grams — all "at least target", rounded to whole units
      const raw = pass ? habit.target * (1 + rng() * 0.3) : habit.target * (0.3 + rng() * 0.55);
      return Math.round(raw);
    }
  }
}

export interface DemoData {
  players: Player[];
  habits: Habit[];
  logs: LogRow[];
  config: ConfigMap;
}

const TOTAL_DAYS = 60;

export function generateDemoData(): DemoData {
  const endDate = today();
  const players: Player[] = PLAYER_SPECS.map((spec) => ({
    playerId: spec.playerId,
    name: spec.name,
    class: spec.class,
    passHash: 'demo-mode-no-password',
    createdAt: addDays(endDate, -(spec.startOffset - 1)),
  }));

  const dailyHabits = DEFAULT_HABITS.filter((h) => h.period === 'daily');
  const weeklyHabits = DEFAULT_HABITS.filter((h) => h.period === 'weekly');
  const logs: LogRow[] = [];

  PLAYER_SPECS.forEach((spec, playerIdx) => {
    const rng = mulberry32(1000 + playerIdx * 7919);
    const cheatUsedThisWeek = new Set<string>();
    const noSugarHabit = DEFAULT_HABITS.find((h) => h.type === 'cheatday');

    for (let i = 0; i < spec.startOffset; i += 1) {
      const dayIndex = spec.startOffset - 1 - i; // 0 = first day joined, increases toward today
      const date = addDays(endDate, -i);
      const consistency = spec.consistencyAt(dayIndex, spec.startOffset);
      const dayQuality = Math.min(0.98, Math.max(0.05, consistency + (rng() - 0.5) * 0.3));
      // Whether this is a "disciplined day" for core habits as a block, rather than flipping
      // each core habit fully independently (which would make "every core habit done" — the
      // good-day requirement — unrealistically rare even for a highly consistent player).
      const coreDayGood = rng() < dayQuality;

      for (const habit of dailyHabits) {
        const passProb = habit.tier === 'core' ? (coreDayGood ? 0.95 : dayQuality * 0.3) : dayQuality * 0.85;

        if (habit.type === 'cheatday' && noSugarHabit) {
          const wk = weekKey(date);
          const alreadyUsedCheat = cheatUsedThisWeek.has(wk);
          const wantsCheat = !alreadyUsedCheat && rng() < (1 - passProb) * 0.4;
          let value: number;
          if (wantsCheat) {
            value = 2;
            cheatUsedThisWeek.add(wk);
          } else {
            value = rng() < passProb ? 1 : 0;
          }
          logs.push({ date, playerId: spec.playerId, habitId: habit.habitId, value, done: value >= 1, updatedAt: `${date}T21:00:00Z` });
          continue;
        }
        const pass = rng() < passProb;
        const value = rollValue(habit, pass, rng);
        logs.push({ date, playerId: spec.playerId, habitId: habit.habitId, value, done: pass, updatedAt: `${date}T21:00:00Z` });
      }

      for (const habit of weeklyHabits) {
        const pass = rng() < dayQuality;
        const value = rollValue(habit, pass, rng);
        logs.push({ date, playerId: spec.playerId, habitId: habit.habitId, value, done: pass, updatedAt: `${date}T21:00:00Z` });
      }
    }
  });

  return { players, habits: DEFAULT_HABITS, logs, config: DEFAULT_CONFIG };
}
