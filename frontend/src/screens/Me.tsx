import React, { useMemo, useState } from 'react';
import { useApp } from '../store/AppProvider';
import { today, weekStart, addDays, daysBetween, minutesToHhmm } from '../lib/day';
import { computeStreaks } from '../lib/scoring';
import { totalXp, levelFromXp, classTitle, computeFloor, computeRuns, computeEarnedBadges, BADGE_DEFINITIONS } from '../lib/rpg';
import { Card, SectionTitle } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';

export function Me() {
  const { session, players, logs, myHabits, baseHabits, config, setOverride, logout, isDemoMode } = useApp();
  const todayStr = today(config.rolloverHour);
  const [editingHabits, setEditingHabits] = useState(false);

  const player = players.find((p) => p.playerId === session?.playerId);
  const myLogs = useMemo(() => logs.filter((l) => l.playerId === session?.playerId), [logs, session]);
  const startDate = player?.createdAt ?? todayStr;

  const streaks = useMemo(() => computeStreaks(session!.playerId, myLogs, myHabits, config, startDate, todayStr), [session, myLogs, myHabits, config, startDate, todayStr]);
  const xp = useMemo(() => totalXp(session!.playerId, myLogs, myHabits, config, startDate, todayStr), [session, myLogs, myHabits, config, startDate, todayStr]);
  const level = levelFromXp(xp);
  const title = player ? classTitle(player.class, level.level) : '';

  const mondays = useMemo(() => {
    const out: string[] = [];
    let m = weekStart(startDate);
    const last = weekStart(todayStr);
    while (m <= last) {
      out.push(m);
      m = addDays(m, 7);
    }
    return out;
  }, [startDate, todayStr]);

  const floors = useMemo(
    () => mondays.map((m) => computeFloor(session!.playerId, myLogs, myHabits, config, m)),
    [mondays, session, myLogs, myHabits, config]
  );
  const runSummary = useMemo(() => computeRuns(floors), [floors]);

  const earnedBadges = useMemo(
    () => computeEarnedBadges({ playerId: session!.playerId, playerLogs: myLogs, habits: myHabits, config, startDate, endDate: todayStr, longestStreak: streaks.longest }),
    [session, myLogs, myHabits, config, startDate, todayStr, streaks.longest]
  );

  const historyDays = daysBetween(addDays(todayStr, -13), todayStr);

  if (!session || !player) return null;

  return (
    <div className="space-y-4 pb-24">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-parchment-50">{player.name}</div>
            <div className="text-sm text-ember-400">
              Lvl {level.level} {title}
            </div>
          </div>
          <button onClick={logout} className="text-sm text-parchment-300 underline">
            Log out
          </button>
        </div>
        <div className="mt-3">
          <ProgressBar
            fraction={level.xpIntoLevel / level.xpForNextLevel}
            colorClass="bg-mana-500"
            label={<span>{level.xpIntoLevel} / {level.xpForNextLevel} XP to next level</span>}
          />
        </div>
        <div className="mt-2 flex justify-between text-sm text-parchment-200">
          <span>🔥 Streak: {streaks.current}</span>
          <span>🏆 Best: {streaks.longest}</span>
          <span>✨ Total XP: {xp}</span>
        </div>
      </Card>

      <Card>
        <SectionTitle>Run History</SectionTitle>
        <div className="mb-2 flex justify-between text-sm text-parchment-200">
          <span>Current run: {runSummary.currentRun} floor{runSummary.currentRun === 1 ? '' : 's'}</span>
          <span>Best run: {runSummary.bestRun} floor{runSummary.bestRun === 1 ? '' : 's'}</span>
        </div>
        <ul className="space-y-1 text-sm">
          {floors
            .slice()
            .reverse()
            .slice(0, 8)
            .map((f) => (
              <li key={f.weekStart} className="flex items-center justify-between rounded bg-dungeon-800 px-2 py-1">
                <span>Floor {f.weekStart}</span>
                <span className={f.pass ? 'text-good-500' : 'text-hp-500'}>{f.pass ? 'Cleared' : 'Failed'}</span>
                <span className="text-parchment-300">{(f.weeklyScore * 100).toFixed(0)}%</span>
              </li>
            ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle>Badges</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BADGE_DEFINITIONS.map((b) => {
            const earned = earnedBadges.has(b.id);
            return (
              <div
                key={b.id}
                title={b.description}
                className={`flex flex-col items-center rounded-md p-2 text-center ${earned ? 'bg-dungeon-600' : 'bg-dungeon-800 opacity-40'}`}
              >
                <span className="text-2xl">{b.icon}</span>
                <span className="mt-1 text-xs text-parchment-100">{b.name}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle>14-Day History</SectionTitle>
        <div className="grid grid-cols-7 gap-1">
          {historyDays.map((d) => (
            <div key={d} className="text-center text-[10px] text-parchment-300">
              {d.slice(8)}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>My Habits</SectionTitle>
          <button onClick={() => setEditingHabits((v) => !v)} className="text-sm text-ember-400 underline">
            {editingHabits ? 'Done' : 'Edit targets'}
          </button>
        </div>
        <ul className="space-y-2">
          {baseHabits.map((habit) => {
            const mine = myHabits.find((h) => h.habitId === habit.habitId)!;
            return (
              <li key={habit.habitId} className="flex items-center justify-between gap-2 text-sm">
                <span className={mine.active ? 'text-parchment-100' : 'text-parchment-400 line-through'}>{habit.name}</span>
                {editingHabits ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      defaultValue={mine.target}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isNaN(n) && n > 0) setOverride(habit.habitId, 'target', n);
                      }}
                      className="min-h-9 w-20 rounded-md border border-dungeon-500 bg-dungeon-800 px-2 text-parchment-50"
                    />
                    <button
                      onClick={() => setOverride(habit.habitId, 'active', !mine.active)}
                      className={`min-h-9 rounded-md px-2 text-xs ${mine.active ? 'bg-good-500 text-dungeon-900' : 'bg-dungeon-500 text-parchment-50'}`}
                    >
                      {mine.active ? 'Active' : 'Off'}
                    </button>
                  </div>
                ) : (
                  <span className="text-parchment-300">
                    target {habit.type === 'time' ? minutesToHhmm(mine.target) : mine.target} {habit.unit}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {isDemoMode && (
        <Card>
          <p className="text-sm text-parchment-300">
            Demo mode: habit edits and logs here are kept only in memory for this preview and reset on reload.
          </p>
        </Card>
      )}
    </div>
  );
}
