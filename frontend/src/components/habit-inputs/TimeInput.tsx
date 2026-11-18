import React from 'react';
import { minutesToHhmm, hhmmToMinutes, minutesSinceRollover } from '../../lib/day';
import { useBecameTrue } from '../../lib/useBecameTrue';

interface TimeInputProps {
  valueMinutes: number | undefined;
  targetMinutes: number;
  toleranceMinutes: number;
  rolloverHour: number;
  onChange: (minutes: number) => void;
}

export function TimeInput({ valueMinutes, targetMinutes, toleranceMinutes, rolloverHour, onChange }: TimeInputProps) {
  const met =
    valueMinutes !== undefined &&
    minutesSinceRollover(valueMinutes, rolloverHour) <= minutesSinceRollover(targetMinutes, rolloverHour) + toleranceMinutes;
  const celebrate = useBecameTrue(met);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="time"
        value={valueMinutes !== undefined ? minutesToHhmm(valueMinutes) : ''}
        onChange={(e) => {
          if (e.target.value) onChange(hhmmToMinutes(e.target.value));
        }}
        className="min-h-14 rounded-xl border border-dungeon-500 bg-dungeon-800 px-3 py-2 text-xl text-parchment-50"
      />
      <span className="text-base text-parchment-200">target {minutesToHhmm(targetMinutes)}</span>
      {valueMinutes !== undefined && (
        <span className={`text-xl ${met ? 'text-good-500' : 'text-hp-500'} ${celebrate ? 'animate-pop-in' : ''}`}>
          {met ? '✓' : '✗'}
        </span>
      )}
    </div>
  );
}
