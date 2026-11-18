import React, { useEffect, useRef, useState } from 'react';
import { ProgressBar } from '../ui/ProgressBar';
import { useBecameTrue } from '../../lib/useBecameTrue';
import * as haptics from '../../lib/haptics';

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
    haptics.tap();
    startRef.current = Date.now();
    setElapsedMs(0);
    setRunning(true);
  };

  const stop = () => {
    haptics.success();
    setRunning(false);
    const seconds = Math.round(elapsedMs / 1000);
    if (seconds > 0) onAddSeconds(seconds);
    setElapsedMs(0);
    startRef.current = null;
  };

  const met = totalSeconds >= targetSeconds;
  const celebrate = useBecameTrue(met);
  const displaySeconds = (elapsedMs / 1000).toFixed(1);
  const roundedTotal = Math.round(totalSeconds);

  return (
    <div>
      <ProgressBar
        fraction={totalSeconds / targetSeconds}
        colorClass={met ? 'bg-good-500' : 'bg-ember-500'}
        celebrate={celebrate}
        label={
          <span className="text-base">
            {roundedTotal}s / {targetSeconds}s {met && <span className="text-good-500">✓</span>}
          </span>
        }
      />
      <div className="mt-3 flex items-center gap-3">
        <div className={`min-w-20 font-mono text-xl text-parchment-50 ${running ? 'animate-pulse' : ''}`}>
          {running ? `${displaySeconds}s` : '0.0s'}
        </div>
        {!running ? (
          <button
            type="button"
            onClick={start}
            className="min-h-14 flex-1 rounded-xl bg-good-500/80 px-3 py-2 text-base font-semibold text-dungeon-900 transition-transform active:scale-95 active:bg-good-500"
          >
            Start Hang
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="min-h-14 flex-1 rounded-xl bg-hp-500/80 px-3 py-2 text-base font-semibold text-parchment-50 transition-transform active:scale-95 active:bg-hp-500"
          >
            Stop & Add
          </button>
        )}
      </div>
    </div>
  );
}
