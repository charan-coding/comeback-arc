import React from 'react';
import { LogRow, Habit, ConfigMap } from '../../api/types';
import { daysBetween, addDays } from '../../lib/day';
import { computeDailyScore, isGoodDay } from '../../lib/scoring';

interface HeatmapCalendarProps {
  playerId: string;
  playerLogs: LogRow[];
  habits: Habit[];
  config: ConfigMap;
  endDate: string;
  days?: number;
  label?: string;
}

function colorFor(score: number, anyLogged: boolean, good: boolean): string {
  if (!anyLogged) return 'bg-dungeon-600';
  if (good) return 'bg-good-500';
  if (score >= 0.4) return 'bg-ember-500';
  return 'bg-hp-500/70';
}

export function HeatmapCalendar({ playerId, playerLogs, habits, config, endDate, days = 30, label }: HeatmapCalendarProps) {
  const startDate = addDays(endDate, -(days - 1));
  const dates = daysBetween(startDate, endDate);

  return (
    <div>
      {label && <div className="mb-2 text-sm font-semibold text-parchment-100">{label}</div>}
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date) => {
          const result = computeDailyScore(date, playerId, playerLogs, habits, config);
          const good = isGoodDay(result, config);
          return (
            <div
              key={date}
              title={`${date}: ${(result.score * 100).toFixed(0)}%`}
              className={`aspect-square rounded-sm ${colorFor(result.score, result.anyLogged, good)}`}
            />
          );
        })}
      </div>
    </div>
  );
}
