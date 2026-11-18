import { Habit } from '../api/types';

/**
 * Canonical seed habits. This list is mirrored by `backend/Code.gs`'s `setup()` function,
 * which writes these exact rows into the Habits sheet on first run. Keep the two in sync —
 * habitId values here are also referenced by name in `lib/rpg.ts` badge logic.
 */
export const DEFAULT_HABITS: Habit[] = [
  { habitId: 'workout_pushups', name: 'Workout: Pushups', category: 'Body', tier: 'core', weight: 1, type: 'counter', target: 50, period: 'daily', active: true, unit: 'reps', group: 'workout' },
  { habitId: 'workout_squats', name: 'Workout: Squats', category: 'Body', tier: 'core', weight: 1, type: 'counter', target: 50, period: 'daily', active: true, unit: 'reps', group: 'workout' },
  { habitId: 'workout_crunches', name: 'Workout: Crunches', category: 'Body', tier: 'core', weight: 1, type: 'counter', target: 50, period: 'daily', active: true, unit: 'reps', group: 'workout' },
  { habitId: 'workout_hang', name: 'Workout: Dead Hangs', category: 'Body', tier: 'core', weight: 1, type: 'duration', target: 300, period: 'daily', active: true, unit: 'seconds', group: 'workout' },
  { habitId: 'workout_cardio', name: 'Workout: Walk/Run', category: 'Body', tier: 'core', weight: 1, type: 'minutes', target: 30, period: 'daily', active: true, unit: 'minutes', group: 'workout' },
  { habitId: 'read', name: 'Read', category: 'Mind', tier: 'bonus', weight: 1, type: 'minutes', target: 30, period: 'daily', active: true, unit: 'minutes' },
  { habitId: 'bed_time', name: 'In Bed By 11:07pm', category: 'Discipline', tier: 'core', weight: 1, type: 'time', target: 23 * 60 + 7, toleranceMinutes: 0, period: 'daily', active: true },
  { habitId: 'wake_time', name: 'Wake By 7:00am', category: 'Discipline', tier: 'core', weight: 1, type: 'time', target: 7 * 60, toleranceMinutes: 0, period: 'daily', active: true },
  { habitId: 'meals_cooked', name: 'Two Cooked Meals', category: 'Fuel', tier: 'bonus', weight: 1, type: 'count', target: 2, period: 'daily', active: true },
  { habitId: 'meds', name: 'Meds & Supplements', category: 'Discipline', tier: 'bonus', weight: 1, type: 'checklist', target: 1, period: 'daily', active: true },
  { habitId: 'protein', name: 'Protein 60g+', category: 'Fuel', tier: 'core', weight: 1, type: 'grams', target: 60, period: 'daily', active: true, unit: 'g' },
  { habitId: 'creatine', name: 'Creatine', category: 'Fuel', tier: 'bonus', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true },
  { habitId: 'screen_time', name: 'Screen Time Under 4h', category: 'Discipline', tier: 'bonus', weight: 1, type: 'hours', target: 4, direction: 'atMost', period: 'daily', active: true, unit: 'h' },
  { habitId: 'no_sugar', name: 'No Sugar', category: 'Fuel', tier: 'core', weight: 1, type: 'cheatday', target: 1, period: 'daily', active: true },
  { habitId: 'portion_control', name: 'Portion Control', category: 'Fuel', tier: 'bonus', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true },
  { habitId: 'water', name: 'Water 2.5L+', category: 'Fuel', tier: 'core', weight: 1, type: 'litres', target: 2.5, period: 'daily', active: true, unit: 'L' },
  { habitId: 'fasting', name: 'Fasting Window Kept', category: 'Discipline', tier: 'bonus', weight: 1, type: 'checkbox', target: 1, period: 'daily', active: true },
  { habitId: 'study', name: 'Study 4-8h', category: 'Mind', tier: 'core', weight: 1, type: 'hours', target: 4, period: 'weekly', active: true, unit: 'h' },
];
