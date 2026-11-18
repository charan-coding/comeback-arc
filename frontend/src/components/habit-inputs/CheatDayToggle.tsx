import React from 'react';
import * as haptics from '../../lib/haptics';

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
        onClick={() => {
          haptics.success();
          onSet(1);
        }}
        className={`min-h-14 flex-1 rounded-xl px-4 py-2 text-base font-semibold transition-transform active:scale-95 ${
          value === 1 ? 'bg-good-500 text-dungeon-900' : 'bg-dungeon-500 text-parchment-50'
        }`}
      >
        Kept it
      </button>
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          onSet(0);
        }}
        className={`min-h-14 flex-1 rounded-xl px-4 py-2 text-base font-semibold transition-transform active:scale-95 ${
          value === 0 ? 'bg-hp-500 text-parchment-50' : 'bg-dungeon-500 text-parchment-50'
        }`}
      >
        Broke it
      </button>
      <button
        type="button"
        disabled={!cheatAvailable && value !== 2}
        onClick={() => {
          haptics.tap();
          onSet(2);
        }}
        className={`min-h-14 flex-1 rounded-xl px-4 py-2 text-base font-semibold transition-transform active:scale-95 disabled:opacity-40 ${
          value === 2 ? 'bg-ember-500 text-dungeon-900' : 'bg-dungeon-500 text-parchment-50'
        }`}
        title={cheatAvailable ? 'Use your weekly cheat token' : 'Cheat token already used this week'}
      >
        Use Cheat Day
      </button>
    </div>
  );
}
