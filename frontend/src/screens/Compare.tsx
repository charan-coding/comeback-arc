import React, { useMemo, useState } from 'react';
import { useApp } from '../store/AppProvider';
import { today, addDays } from '../lib/day';
import { Card, SectionTitle } from '../components/ui/Card';
import { HeatmapCalendar } from '../components/charts/HeatmapCalendar';
import { WeeklyScoreLine } from '../components/charts/WeeklyScoreLine';
import { CategoryRadar } from '../components/charts/CategoryRadar';
import { HabitCompletionBars } from '../components/charts/HabitCompletionBars';

export function Compare() {
  const { players, logs, habitsForPlayerId, baseHabits, config } = useApp();
  const [selected, setSelected] = useState<string[]>(() => players.slice(0, 2).map((p) => p.playerId));
  const todayStr = today(config.rolloverHour);
  const windowStart = addDays(todayStr, -29);

  const selectedPlayers = players.filter((p) => selected.includes(p.playerId));
  const logsByPlayer = useMemo(() => {
    const map: Record<string, typeof logs> = {};
    for (const p of selectedPlayers) map[p.playerId] = logs.filter((l) => l.playerId === p.playerId);
    return map;
  }, [logs, selectedPlayers]);
  const habitsByPlayer = useMemo(() => {
    const map: Record<string, ReturnType<typeof habitsForPlayerId>> = {};
    for (const p of selectedPlayers) map[p.playerId] = habitsForPlayerId(p.playerId);
    return map;
  }, [selectedPlayers, habitsForPlayerId]);

  function toggle(playerId: string) {
    setSelected((prev) => (prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]));
  }

  return (
    <div className="space-y-4 pb-24">
      <Card>
        <SectionTitle>Choose Players (2+)</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => (
            <button
              key={p.playerId}
              onClick={() => toggle(p.playerId)}
              className={`min-h-10 rounded-full px-3 py-1 text-sm ${
                selected.includes(p.playerId) ? 'bg-ember-500 text-dungeon-900' : 'bg-dungeon-600 text-parchment-100'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </Card>

      {selectedPlayers.length < 2 ? (
        <Card>
          <p className="text-sm text-parchment-200">Pick at least two players to compare.</p>
        </Card>
      ) : (
        <>
          <Card>
            <SectionTitle>30-Day Heatmap</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {selectedPlayers.map((p) => (
                <HeatmapCalendar
                  key={p.playerId}
                  playerId={p.playerId}
                  playerLogs={logsByPlayer[p.playerId]}
                  habits={habitsByPlayer[p.playerId]}
                  config={config}
                  endDate={todayStr}
                  label={p.name}
                />
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>Weekly Score</SectionTitle>
            <WeeklyScoreLine players={selectedPlayers} logsByPlayer={logsByPlayer} habitsByPlayer={habitsByPlayer} config={config} endDate={todayStr} />
          </Card>

          <Card>
            <SectionTitle>Category Breakdown</SectionTitle>
            <CategoryRadar
              players={selectedPlayers}
              logsByPlayer={logsByPlayer}
              habitsByPlayer={habitsByPlayer}
              config={config}
              startDate={windowStart}
              endDate={todayStr}
            />
          </Card>

          <Card>
            <SectionTitle>Per-Habit Completion (30d)</SectionTitle>
            <HabitCompletionBars
              players={selectedPlayers}
              logsByPlayer={logsByPlayer}
              baseHabits={baseHabits}
              config={config}
              startDate={windowStart}
              endDate={todayStr}
            />
          </Card>
        </>
      )}
    </div>
  );
}
