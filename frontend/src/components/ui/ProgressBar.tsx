import React from 'react';

export function ProgressBar({
  fraction,
  colorClass = 'bg-good-500',
  label,
  celebrate = false,
}: {
  fraction: number;
  colorClass?: string;
  label?: React.ReactNode;
  /** Plays a brief outward "flash" ring once, meant for the instant a habit flips to done. */
  celebrate?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div>
      {label && <div className="mb-1.5 flex justify-between text-sm text-parchment-200">{label}</div>}
      <div
        className={`h-5 w-full overflow-hidden rounded-full bg-dungeon-600 ${celebrate ? 'animate-flash-good' : ''}`}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full transition-all duration-300 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
