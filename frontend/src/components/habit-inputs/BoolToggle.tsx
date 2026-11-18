import React from 'react';

export function BoolToggle({ value, onSet }: { value: number | undefined; onSet: (value: number) => void }) {
  const done = (value ?? 0) >= 1;
  return (
    <button
      type="button"
      onClick={() => onSet(done ? 0 : 1)}
      className={`min-h-11 w-full rounded-md px-4 py-2 text-left text-sm font-semibold ${
        done ? 'bg-good-500 text-dungeon-900' : 'bg-dungeon-500 text-parchment-50'
      }`}
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
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onSet(Math.max(0, v - 1))}
        className="flex h-11 w-11 items-center justify-center rounded-md bg-dungeon-500 text-xl text-parchment-50"
      >
        −
      </button>
      <span className={`min-w-14 text-center text-lg font-semibold ${v >= target ? 'text-good-500' : 'text-parchment-50'}`}>
        {v} / {target}
      </span>
      <button
        type="button"
        onClick={() => onSet(v + 1)}
        className="flex h-11 w-11 items-center justify-center rounded-md bg-dungeon-500 text-xl text-parchment-50"
      >
        +
      </button>
    </div>
  );
}
