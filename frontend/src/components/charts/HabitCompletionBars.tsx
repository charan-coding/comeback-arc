import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Habit, LogRow, ConfigMap, Player } from '../../api/types';
import { daysBetween } from '../../lib/day';
import { computeDailyScore } from '../../lib/scoring';

const COLORS = ['#e8a33d', '#3b6fc2', '#3bc26b', '#c23b3b'];

interface HabitCompletionBarsProps {
  players: Player[];
  logsByPlayer: Record<string, LogRow[]>;
  baseHabits: Habit[];
  config: ConfigMap;
  startDate: string;
  endDate: string;
}

export function HabitCompletionBars({ players, logsByPlayer, baseHabits, config, startDate, endDate }: HabitCompletionBarsProps) {
  const dailyHabits = baseHabits.filter((h) => h.active && h.period === 'daily');
  const dates = daysBetween(startDate, endDate);

  const data = dailyHabits.map((habit) => {
    const row: Record<string, number | string> = { habit: habit.name.replace('Workout: ', 'W: ') };
    for (const player of players) {
      const playerLogs = logsByPlayer[player.playerId] ?? [];
      let done = 0;
      for (const date of dates) {
        const result = computeDailyScore(date, player.playerId, playerLogs, [habit], config);
        if (result.perHabit[habit.habitId]) done += 1;
      }
      row[player.name] = Math.round((done / dates.length) * 100);
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, dailyHabits.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#352641" />
        <XAxis type="number" domain={[0, 100]} stroke="#ddc99e" fontSize={12} />
        <YAxis type="category" dataKey="habit" width={110} stroke="#ddc99e" fontSize={11} />
        <Tooltip contentStyle={{ background: '#1b1420', border: '1px solid #4a3459', color: '#f7f0e3' }} />
        <Legend />
        {players.map((player, i) => (
          <Bar key={player.playerId} dataKey={player.name} fill={COLORS[i % COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
