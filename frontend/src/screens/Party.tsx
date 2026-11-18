import React, { useMemo, useState } from 'react';
import { useApp } from '../store/AppProvider';
import { today } from '../lib/day';
import { computeConsistency, computeDailyScore, computeStreaks, isGoodDay } from '../lib/scoring';
import { totalXp, levelFromXp, classTitle } from '../lib/rpg';
import { Card, SectionTitle } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';

type Metric = 'consistency' | 'streak' | 'xp' | 'week';

const METRIC_LABEL: Record<Metric, string> = {
  consistency: 'Consistency (30d)',
  streak: 'Current Streak',
  xp: 'XP',
  week: 'This Week',
};

export function Party() {
  const { players, logs, habitsForPlayerId, config } = useApp();
  const [metric, setMetric] = useState<Metric>('consistency');
  const todayStr = today(config.rolloverHour);

  const rows = useMemo(() => {
    return players.map((player) => {
      const habits = habitsForPlayerId(player.playerId);
      const playerLogs = logs.filter((l) => l.playerId === player.playerId);
      const startDate = player.createdAt;

      const consistency = computeConsistency(player.playerId, playerLogs, habits, config, 30, todayStr, startDate);
      const streaks = computeStreaks(player.playerId, playerLogs, habits, config, startDate, todayStr);
      const xp = totalXp(player.playerId, playerLogs, habits, config, startDate, todayStr);
      const level = levelFromXp(xp);
      const today7 = computeConsistency(player.playerId, playerLogs, habits, config, 7, todayStr, startDate);
      const todayResult = computeDailyScore(todayStr, player.playerId, playerLogs, habits, config);

      return {
        player,
        level,
        title: classTitle(player.class, level.level),
        consistency: consistency.consistencyRate,
        streak: streaks.current,
        xp,
        week: today7.consistencyRate,
        loggedToday: todayResult.anyLogged,
        goodToday: isGoodDay(todayResult, config),
        todayScore: todayResult.score,
      };
    });
  }, [players, logs, habitsForPlayerId, config, todayStr]);

  const sorted = [...rows].sort((a, b) => b[metric] - a[metric]);
  const partyHp = rows.length > 0 ? rows.reduce((sum, r) => sum + r.todayScore, 0) / rows.length : 0;
  const everyoneLogged = rows.length > 0 && rows.every((r) => r.loggedToday);

  return (
    <div className="space-y-4 pb-24">
      <Card>
        <SectionTitle>Party HP — Today</SectionTitle>
        <ProgressBar fraction={partyHp} colorClass="bg-hp-500" label={<span>{(partyHp * 100).toFixed(0)}% filled</span>} />
        {everyoneLogged && <p className="mt-2 text-sm text-ember-400">⚡ Party Buff: everyone logged today!</p>}
      </Card>

      <div className="flex gap-2 overflow-x-auto">
        {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`min-h-10 whitespace-nowrap rounded-full px-3 py-1 text-sm ${
              metric === m ? 'bg-ember-500 text-dungeon-900' : 'bg-dungeon-600 text-parchment-100'
            }`}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}
      </div>

      <Card>
        <ul className="space-y-3">
          {sorted.map((row, i) => (
            <li key={row.player.playerId} className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-parchment-50">
                  #{i + 1} {row.player.name}{' '}
                  {row.goodToday && (
                    <span className="text-xs text-good-500" title="Good day">
                      ✓
                    </span>
                  )}
                </div>
                <div className="text-xs text-parchment-300">
                  Lvl {row.level.level} {row.title}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg text-ember-400">
                  {metric === 'consistency' && `${(row.consistency * 100).toFixed(0)}%`}
                  {metric === 'streak' && `${row.streak}d`}
                  {metric === 'xp' && row.xp}
                  {metric === 'week' && `${(row.week * 100).toFixed(0)}%`}
                </div>
                {row.loggedToday ? (
                  <div className="text-xs text-good-500">logged today</div>
                ) : (
                  <div className="text-xs text-parchment-400">no log yet</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
