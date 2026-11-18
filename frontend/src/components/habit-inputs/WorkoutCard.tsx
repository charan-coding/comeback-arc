import React from 'react';
import { Habit } from '../../api/types';
import { Card, SectionTitle } from '../ui/Card';
import { ChunkStepper } from './ChunkStepper';
import { HangStopwatch } from './HangStopwatch';

interface WorkoutCardProps {
  habits: Habit[]; // the workout-group habits, in any order
  valuesByHabitId: Record<string, number>;
  onAdd: (habitId: string, amount: number) => void;
}

const STEP_BY_HABIT: Record<string, number> = {
  workout_pushups: 10,
  workout_squats: 10,
  workout_crunches: 10,
  workout_cardio: 5,
};

export function WorkoutCard({ habits, valuesByHabitId, onAdd }: WorkoutCardProps) {
  const hangHabit = habits.find((h) => h.habitId === 'workout_hang');
  const otherHabits = habits.filter((h) => h.habitId !== 'workout_hang');
  const allMet = habits.every((h) => (valuesByHabitId[h.habitId] ?? 0) >= h.target);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>Daily Workout</SectionTitle>
        {allMet && <span className="text-sm text-good-500">Quest complete</span>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {otherHabits.map((habit) => (
          <div key={habit.habitId}>
            <div className="mb-1 text-sm font-semibold text-parchment-100">{habit.name.replace('Workout: ', '')}</div>
            <ChunkStepper
              value={valuesByHabitId[habit.habitId] ?? 0}
              target={habit.target}
              unit={habit.unit}
              step={STEP_BY_HABIT[habit.habitId] ?? 10}
              onAdd={(amount) => onAdd(habit.habitId, amount)}
            />
          </div>
        ))}
        {hangHabit && (
          <div>
            <div className="mb-1 text-sm font-semibold text-parchment-100">Dead Hangs</div>
            <HangStopwatch
              totalSeconds={valuesByHabitId[hangHabit.habitId] ?? 0}
              targetSeconds={hangHabit.target}
              onAddSeconds={(s) => onAdd(hangHabit.habitId, s)}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
