import React from 'react';
import { useBecameTrue } from '../../lib/useBecameTrue';
import * as haptics from '../../lib/haptics';

export function BoolToggle({ value, onSet }: { value: number | undefined; onSet: (value: number) => void }) {
  const done = (value ?? 0) >= 1;
  const celebrate = useBecameTrue(done);
  return (
    <button
      type="button"
      onClick={() => {
        if (!done) haptics.success();
        else haptics.tap();
        onSet(done ? 0 : 1);
      }}
      className={`min-h-14 w-full rounded-xl px-4 py-3 text-left text-base font-semibold transition-transform active:scale-[0.98] ${
        done ? 'bg-good-500 text-dungeon-900' : 'bg-dungeon-500 text-parchment-50'
      } ${celebrate ? 'animate-pop-in' : ''}`}
    >
      {done ? '☑ Done' : '☐ Not yet'}
    </button>
  );
}

export function CountStepper({
  value,
  target,
  onSet,
}: {
  value: number | undefined;
  target: number;
  onSet: (value: number) => void;
}) {
  const v = value ?? 0;
  const met = v >= target;
  const celebrate = useBecameTrue(met);
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          onSet(Math.max(0, v - 1));
        }}
        className="flex h-14 w-14 items-center justify-center rounded-xl bg-dungeon-500 text-2xl text-parchment-50 transition-transform active:scale-90"
      >
        −
      </button>
      <span
        className={`min-w-16 text-center text-xl font-semibold ${met ? 'text-good-500' : 'text-parchment-50'} ${celebrate ? 'animate-pop-in' : ''}`}
      >
        {v} / {target}
      </span>
      <button
        type="button"
        onClick={() => {
          if (v + 1 >= target) haptics.success();
          else haptics.tap();
          onSet(v + 1);
        }}
        className="flex h-14 w-14 items-center justify-center rounded-xl bg-dungeon-500 text-2xl text-parchment-50 transition-transform active:scale-90"
      >
        +
      </button>
    </div>
  );
}
