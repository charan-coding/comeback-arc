import React, { useState } from 'react';
import { ProgressBar } from '../ui/ProgressBar';
import { useBecameTrue } from '../../lib/useBecameTrue';

interface NumberInputProps {
  value: number | undefined;
  target: number;
  unit?: string;
  direction?: 'atLeast' | 'atMost';
  onSet: (value: number) => void;
}

/** A single reported value for the day (e.g. screen time), not a cumulative chunk-add. */
export function NumberInput({ value, target, unit = '', direction = 'atLeast', onSet }: NumberInputProps) {
  const [draft, setDraft] = useState(value !== undefined ? String(value) : '');
  const met = value !== undefined && (direction === 'atLeast' ? value >= target : value <= target);
  const fraction = value === undefined ? 0 : direction === 'atLeast' ? value / target : target > 0 ? 1 - value / target : 1;
  const celebrate = useBecameTrue(met);

  return (
    <div>
      <ProgressBar
        fraction={fraction}
        colorClass={met ? 'bg-good-500' : 'bg-ember-500'}
        celebrate={celebrate}
        label={
          <span className="text-base">
            {direction === 'atMost' ? 'under' : 'target'} {target} {unit}
            {met && <span className="ml-2 text-good-500">✓</span>}
          </span>
        }
      />
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Number(draft);
            if (!Number.isNaN(n)) onSet(n);
          }}
          className="min-h-14 w-28 rounded-xl border border-dungeon-500 bg-dungeon-800 px-3 text-xl text-parchment-50"
        />
        <span className="text-base text-parchment-200">{unit}</span>
      </div>
    </div>
  );
}
