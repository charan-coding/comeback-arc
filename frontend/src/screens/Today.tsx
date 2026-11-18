import React, { useMemo, useState } from 'react';
import { useApp } from '../store/AppProvider';
import { Habit } from '../api/types';
import { today, addDays, isEditable, weekKey } from '../lib/day';
import { computeDailyScore, isGoodDay, computeStreaks } from '../lib/scoring';
import { Card, SectionTitle } from '../components/ui/Card';
import { useBecameTrue } from '../lib/useBecameTrue';
import * as haptics from '../lib/haptics';
import { ProgressBar } from '../components/ui/ProgressBar';
import { WorkoutCard } from '../components/habit-inputs/WorkoutCard';
import { ChunkStepper } from '../components/habit-inputs/ChunkStepper';
import { NumberInput } from '../components/habit-inputs/NumberInput';
import { TimeInput } from '../components/habit-inputs/TimeInput';
import { CheatDayToggle } from '../components/habit-inputs/CheatDayToggle';
import { MedsChecklist } from '../components/habit-inputs/MedsChecklist';
import { BoolToggle, CountStepper } from '../components/habit-inputs/BoolToggle';

const CHUNK_STEP: Record<string, number> = { protein: 10, water: 0.25, read: 10 };

export function Today() {
  const { session, players, myHabits, logs, config, logHabit } = useApp();
  const todayStr = today(config.rolloverHour);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const myLogs = useMemo(() => logs.filter((l) => l.playerId === session?.playerId), [logs, session]);
  const valuesByHabitId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of myLogs) if (l.date === selectedDate) map[l.habitId] = l.value;
    return map;
  }, [myLogs, selectedDate]);

  const dailyHabits = myHabits.filter((h) => h.active && h.period === 'daily');
  const weeklyHabits = myHabits.filter((h) => h.active && h.period === 'weekly');
  const workoutHabits = dailyHabits.filter((h) => h.group === 'workout');
  const otherHabits = dailyHabits.filter((h) => h.group !== 'workout');

  const dailyResult = useMemo(
    () => computeDailyScore(selectedDate, session?.playerId ?? '', myLogs, myHabits, config),
    [selectedDate, session, myLogs, myHabits, config]
  );
  const good = isGoodDay(dailyResult, config);

  const myPlayer = players.find((p) => p.playerId === session?.playerId);
  const streaks = useMemo(() => {
    if (!session) return { current: 0, longest: 0 };
    const startDate = myPlayer?.createdAt ?? todayStr;
    return computeStreaks(session.playerId, myLogs, myHabits, config, startDate, todayStr);
  }, [session, myPlayer, myLogs, myHabits, config, todayStr]);

  const editable = isEditable(selectedDate, config.rolloverHour, config.backfillDays);
  const canGoPrev = isEditable(addDays(selectedDate, -1), config.rolloverHour, config.backfillDays);
  const canGoNext = selectedDate !== todayStr;

  const noSugarHabit = myHabits.find((h) => h.type === 'cheatday');
  const cheatUsedElsewhereCount = noSugarHabit
    ? myLogs.filter(
        (l) => l.habitId === noSugarHabit.habitId && weekKey(l.date) === weekKey(selectedDate) && l.date !== selectedDate && l.value === 2
      ).length
    : 0;
  const cheatAvailable = cheatUsedElsewhereCount < config.cheatDayLimit;

  if (!session) return null;
  const playerId = session.playerId;

  function set(habitId: string, value: number) {
    if (!editable) return;
    logHabit(selectedDate, habitId, value);
  }

  function renderInput(habit: Habit) {
    const value = valuesByHabitId[habit.habitId];
    const onSet = (v: number) => set(habit.habitId, v);
    const onAdd = (delta: number) => set(habit.habitId, (value ?? 0) + delta);

    switch (habit.type) {
      case 'checkbox':
        return <BoolToggle value={value} onSet={onSet} />;
      case 'count':
        return <CountStepper value={value} target={habit.target} onSet={onSet} />;
      case 'time':
        return (
          <TimeInput
            valueMinutes={value}
            targetMinutes={habit.target}
            toleranceMinutes={habit.toleranceMinutes ?? 0}
            rolloverHour={config.rolloverHour}
            onChange={onSet}
          />
        );
      case 'cheatday':
        return <CheatDayToggle value={value} cheatAvailable={cheatAvailable} onSet={onSet} />;
      case 'checklist':
        return <MedsChecklist playerId={playerId} date={selectedDate} yesterday={addDays(selectedDate, -1)} value={value} onSet={onSet} />;
      case 'hours':
        return <NumberInput value={value} target={habit.target} unit={habit.unit} direction={habit.direction} onSet={onSet} />;
      default:
        return (
          <ChunkStepper
            value={value ?? 0}
            target={habit.target}
            unit={habit.unit}
            step={CHUNK_STEP[habit.habitId] ?? 1}
            direction={habit.direction}
            onAdd={onAdd}
            decimals={habit.type === 'litres' ? 2 : 0}
          />
        );
    }
  }

  const justBecameGoodDay = useBecameTrue(good);

  return (
    <div className="space-y-4 pb-24">
      <Card className={justBecameGoodDay ? 'animate-flash-good' : ''}>
        <div className="flex items-center justify-between">
          <button
            disabled={!canGoPrev}
            onClick={() => {
              haptics.tap();
              setSelectedDate(addDays(selectedDate, -1));
            }}
            className="min-h-11 px-2 text-base font-semibold text-ember-400 disabled:opacity-30"
          >
            ← Prev
          </button>
          <div className="text-center">
            <div className="text-2xl font-bold text-parchment-50">{selectedDate === todayStr ? 'Today' : selectedDate}</div>
            {!editable && <div className="text-xs text-parchment-300">read-only (outside backfill window)</div>}
          </div>
          <button
            disabled={!canGoNext}
            onClick={() => {
              haptics.tap();
              setSelectedDate(addDays(selectedDate, 1));
            }}
            className="min-h-11 px-2 text-base font-semibold text-ember-400 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
        <div className="mt-4">
          <ProgressBar
            fraction={dailyResult.score}
            colorClass={good ? 'bg-good-500' : 'bg-ember-500'}
            label={
              <span className="text-lg font-semibold">
                Score {(dailyResult.score * 100).toFixed(0)}%{good && <span className="text-good-500"> · Good Day</span>}
              </span>
            }
          />
        </div>
        {justBecameGoodDay && (
          <div className="mt-3 animate-pop-in rounded-xl bg-good-500/15 px-4 py-2 text-center text-base font-semibold text-good-500">
            🎉 Good day! The party is proud of you.
          </div>
        )}
        <div className="mt-3 flex justify-between text-base text-parchment-200">
          <span>🔥 Current streak: {streaks.current}</span>
          <span>🏆 Longest: {streaks.longest}</span>
        </div>
      </Card>

      {workoutHabits.length > 0 && (
        <WorkoutCard habits={workoutHabits} valuesByHabitId={valuesByHabitId} onAdd={(id, amt) => set(id, (valuesByHabitId[id] ?? 0) + amt)} />
      )}

      {otherHabits.map((habit) => (
        <Card key={habit.habitId}>
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>{habit.name}</SectionTitle>
            <span className="text-xs uppercase text-parchment-300">{habit.tier}</span>
          </div>
          {renderInput(habit)}
        </Card>
      ))}

      {weeklyHabits.map((habit) => (
        <Card key={habit.habitId}>
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>{habit.name} (this week)</SectionTitle>
            <span className="text-xs uppercase text-parchment-300">{habit.tier}</span>
          </div>
          <ChunkStepper
            value={valuesByHabitId[habit.habitId] ?? 0}
            target={habit.target}
            unit={habit.unit}
            step={1}
            onAdd={(amt) => set(habit.habitId, (valuesByHabitId[habit.habitId] ?? 0) + amt)}
            decimals={1}
          />
          <p className="mt-1 text-xs text-parchment-300">Logged for today only — see your weekly total on the Me screen.</p>
        </Card>
      ))}
    </div>
  );
}
