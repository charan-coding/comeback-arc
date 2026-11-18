import React, { useState } from 'react';
import { ProgressBar } from '../ui/ProgressBar';

interface ChunkStepperProps {
  value: number;
  target: number;
  unit?: string;
  step: number;
  onAdd: (amount: number) => void;
  decimals?: number;
  direction?: 'atLeast' | 'atMost';
}

/** A cumulative counter: quick-add the common chunk size, or type any custom amount ("20 then 30"). */
export function ChunkStepper({ value, target, unit = '', step, onAdd, decimals = 0, direction = 'atLeast' }: ChunkStepperProps) {
  const [custom, setCustom] = useState('');
  const met = direction === 'atLeast' ? value >= target : value <= target;
  const fraction = direction === 'atLeast' ? value / target : target > 0 ? 1 - Math.max(0, value - target) / target : 1;

  return (
    <div>
      <ProgressBar
        fraction={fraction}
        colorClass={met ? 'bg-good-500' : 'bg-ember-500'}
        label={
          <>
            <span>
              {value.toFixed(decimals)} / {target.toFixed(decimals)} {unit}
            </span>
            {met && <span className="text-good-500">✓</span>}
          </>
        }
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onAdd(step)}
          className="min-h-11 flex-1 rounded-md bg-dungeon-500 px-3 py-2 text-sm font-semibold text-parchment-50 active:bg-dungeon-600"
        >
          +{step} {unit}
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="custom"
          className="min-h-11 w-20 rounded-md border border-dungeon-500 bg-dungeon-800 px-2 text-sm text-parchment-50"
        />
        <button
          type="button"
          onClick={() => {
            const n = Number(custom);
            if (!Number.isNaN(n) && n !== 0) {
              onAdd(n);
              setCustom('');
            }
          }}
          className="min-h-11 rounded-md bg-dungeon-500 px-3 py-2 text-sm font-semibold text-parchment-50 active:bg-dungeon-600"
        >
          Add
        </button>
      </div>
    </div>
  );
}
