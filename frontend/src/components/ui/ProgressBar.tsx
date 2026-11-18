import React from 'react';

export function ProgressBar({
  fraction,
  colorClass = 'bg-good-500',
  label,
}: {
  fraction: number;
  colorClass?: string;
  label?: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div>
      {label && <div className="mb-1 flex justify-between text-xs text-parchment-200">{label}</div>}
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-dungeon-600"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
