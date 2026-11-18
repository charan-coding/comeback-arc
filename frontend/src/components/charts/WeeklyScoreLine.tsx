import React from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Habit, LogRow, ConfigMap, Player } from '../../api/types';
import { addDays, weekStart, weekDates } from '../../lib/day';
import { computeDailyScore } from '../../lib/scoring';

const COLORS = ['#e8a33d', '#3b6fc2', '#3bc26b', '#c23b3b'];

interface WeeklyScoreLineProps {
  players: Player[];
  logsByPlayer: Record<string, LogRow[]>;
  habitsByPlayer: Record<string, Habit[]>;
  config: ConfigMap;
  endDate: string;
  weeks?: number;
}

export function WeeklyScoreLine({ players, logsByPlayer, habitsByPlayer, config, endDate, weeks = 6 }: WeeklyScoreLineProps) {
  const firstMonday = weekStart(addDays(endDate, -7 * (weeks - 1)));
  const mondays: string[] = [];
  for (let i = 0; i < weeks; i += 1) mondays.push(addDays(firstMonday, i * 7));

  const data = mondays.map((monday) => {
    const row: Record<string, number | string> = { week: monday.slice(5) };
    for (const player of players) {
      const habits = habitsByPlayer[player.playerId] ?? [];
      const playerLogs = logsByPlayer[player.playerId] ?? [];
      const days = weekDates(monday).filter((d) => d <= endDate);
      const scores = days.map((d) => computeDailyScore(d, player.playerId, playerLogs, habits, config));
      const logged = scores.filter((s) => s.anyLogged);
      const avg = logged.length > 0 ? logged.reduce((sum, s) => sum + s.score, 0) / logged.length : 0;
      row[player.name] = Math.round(avg * 100);
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#352641" />
        <XAxis dataKey="week" stroke="#ddc99e" fontSize={12} />
        <YAxis stroke="#ddc99e" fontSize={12} domain={[0, 100]} />
        <Tooltip contentStyle={{ background: '#1b1420', border: '1px solid #4a3459', color: '#f7f0e3' }} />
        <Legend />
        {players.map((player, i) => (
          <Line key={player.playerId} type="monotone" dataKey={player.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
