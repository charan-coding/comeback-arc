import React, { useEffect, useRef, useState } from 'react';
import { ProgressBar } from '../ui/ProgressBar';

interface HangStopwatchProps {
  totalSeconds: number;
  targetSeconds: number;
  onAddSeconds: (seconds: number) => void;
}

/** Dead-hang stopwatch: start/stop a set, and the elapsed time is added to today's cumulative total. */
export function HangStopwatch({ totalSeconds, targetSeconds, onAddSeconds }: HangStopwatchProps) {
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (startRef.current !== null) setElapsedMs(Date.now() - startRef.current);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [running]);

  const start = () => {
    startRef.current = Date.now();
    setElapsedMs(0);
    setRunning(true);
  };

  const stop = () => {
    setRunning(false);
    const seconds = Math.round(elapsedMs / 1000);
    if (seconds > 0) onAddSeconds(seconds);
    setElapsedMs(0);
    startRef.current = null;
  };

  const met = totalSeconds >= targetSeconds;
  const displaySeconds = (elapsedMs / 1000).toFixed(1);
  const roundedTotal = Math.round(totalSeconds);

  return (
    <div>
      <ProgressBar
        fraction={totalSeconds / targetSeconds}
        colorClass={met ? 'bg-good-500' : 'bg-ember-500'}
        label={
          <span>
            {roundedTotal}s / {targetSeconds}s {met && <span className="text-good-500">✓</span>}
          </span>
        }
      />
      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-16 font-mono text-lg text-parchment-50">{running ? `${displaySeconds}s` : '0.0s'}</div>
        {!running ? (
          <button
            type="button"
            onClick={start}
            className="min-h-11 flex-1 rounded-md bg-good-500/80 px-3 py-2 text-sm font-semibold text-dungeon-900 active:bg-good-500"
          >
            Start Hang
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="min-h-11 flex-1 rounded-md bg-hp-500/80 px-3 py-2 text-sm font-semibold text-parchment-50 active:bg-hp-500"
          >
            Stop & Add
          </button>
        )}
      </div>
    </div>
  );
}
