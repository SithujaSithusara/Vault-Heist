'use client';

import { useEffect, useState } from 'react';

type HeistTimerProps = {
  initialElapsedMs: number;
};

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `${minutes}:${seconds}`;
}

export function HeistTimer({ initialElapsedMs }: HeistTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(initialElapsedMs);

  useEffect(() => {
    const mountedAt = performance.now();

    function updateTimer() {
      setElapsedMs(initialElapsedMs + performance.now() - mountedAt);
    }

    const interval = window.setInterval(updateTimer, 250);
    document.addEventListener('visibilitychange', updateTimer);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', updateTimer);
    };
  }, [initialElapsedMs]);

  return (
    <div className="mt-4">
      <p className="text-sm font-bold text-heist-muted">Elapsed time</p>
      <p className="mt-1 font-heist-mono text-4xl font-medium text-heist-yellow tabular-nums">
        {formatElapsed(elapsedMs)}
      </p>
    </div>
  );
}