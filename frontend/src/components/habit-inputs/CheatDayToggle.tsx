import React from 'react';

interface CheatDayToggleProps {
  value: number | undefined; // 0 = broke it, 1 = kept it, 2 = used a cheat token
  cheatAvailable: boolean; // true if no OTHER day this week has already used the cheat token
  onSet: (value: number) => void;
}

export function CheatDayToggle({ value, cheatAvailable, onSet }: CheatDayToggleProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSet(1)}
        className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${
          value === 1 ? 'bg-good-500 text-dungeon-900' : 'bg-dungeon-500 text-parchment-50'
        }`}
      >
        Kept it
      </button>
      <button
        type="button"
        onClick={() => onSet(0)}
        className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${
          value === 0 ? 'bg-hp-500 text-parchment-50' : 'bg-dungeon-500 text-parchment-50'
        }`}
      >
        Broke it
      </button>
      <button
        type="button"
        disabled={!cheatAvailable && value !== 2}
        onClick={() => onSet(2)}
        className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-40 ${
          value === 2 ? 'bg-ember-500 text-dungeon-900' : 'bg-dungeon-500 text-parchment-50'
        }`}
        title={cheatAvailable ? 'Use your weekly cheat token' : 'Cheat token already used this week'}
      >
        Use Cheat Day
      </button>
    </div>
  );
}
