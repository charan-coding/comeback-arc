import React from 'react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Habit, LogRow, ConfigMap, Player, Category } from '../../api/types';
import { computeCategoryRates } from '../../lib/scoring';

const COLORS = ['#e8a33d', '#3b6fc2', '#3bc26b', '#c23b3b'];
const CATEGORIES: Category[] = ['Body', 'Fuel', 'Mind', 'Discipline'];

interface CategoryRadarProps {
  players: Player[];
  logsByPlayer: Record<string, LogRow[]>;
  habitsByPlayer: Record<string, Habit[]>;
  config: ConfigMap;
  startDate: string;
  endDate: string;
}

export function CategoryRadar({ players, logsByPlayer, habitsByPlayer, config, startDate, endDate }: CategoryRadarProps) {
  const data = CATEGORIES.map((category) => {
    const row: Record<string, number | string> = { category };
    for (const player of players) {
      const habits = habitsByPlayer[player.playerId] ?? [];
      const playerLogs = logsByPlayer[player.playerId] ?? [];
      const rates = computeCategoryRates(player.playerId, playerLogs, habits, config, startDate, endDate);
      row[player.name] = Math.round(rates[category].rate * 100);
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="#352641" />
        <PolarAngleAxis dataKey="category" stroke="#ddc99e" fontSize={12} />
        <Tooltip contentStyle={{ background: '#1b1420', border: '1px solid #4a3459', color: '#f7f0e3' }} />
        <Legend />
        {players.map((player, i) => (
          <Radar
            key={player.playerId}
            name={player.name}
            dataKey={player.name}
            stroke={COLORS[i % COLORS.length]}
            fill={COLORS[i % COLORS.length]}
            fillOpacity={0.15}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}
