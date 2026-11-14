'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

type HeistTimerProps = {
  initialElapsedMs: number;
  penaltySeconds: number;
  alarmRemainingMs: number;
};

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `${minutes}:${seconds}`;
}

function useElapsedSinceMount() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const mountedAt = performance.now();

    function updateTimer() {
      setElapsedMs(performance.now() - mountedAt);
    }

    const interval = window.setInterval(updateTimer, 250);
    document.addEventListener('visibilitychange', updateTimer);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', updateTimer);
    };
  }, []);

  return elapsedMs;
}

export function HeistTimer({ initialElapsedMs, penaltySeconds, alarmRemainingMs }: HeistTimerProps) {
  const elapsedSinceMount = useElapsedSinceMount();
  const elapsedMs = initialElapsedMs + elapsedSinceMount;
  const alarmSeconds = Math.max(0, Math.ceil((alarmRemainingMs - elapsedSinceMount) / 1000));

  return (
    <div className="mt-4">
      <p className="text-sm font-bold text-heist-muted">Elapsed time</p>
      <p className="mt-1 font-heist-mono text-4xl font-medium text-heist-yellow tabular-nums">
        {formatElapsed(elapsedMs)}
      </p>
      <p className="mt-2 text-sm text-heist-muted">Penalty: +{penaltySeconds}s</p>
      {alarmSeconds > 0 && (
        <p className="mt-2 font-bold text-heist-red">Alarm active · {alarmSeconds}s</p>
      )}
    </div>
  );
}
export function CheckDigitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="h-11 enabled:cursor-pointer bg-heist-yellow font-bold text-heist-ink hover:bg-heist-yellow/90">
      {pending ? 'Checking…' : 'Check digit'}
    </Button>
  );
}

export function ReplacementButton({ initialCooldownMs }: { initialCooldownMs: number }) {
  const { pending } = useFormStatus();
  const elapsedMs = useElapsedSinceMount();
  const seconds = Math.max(0, Math.ceil((initialCooldownMs - elapsedMs) / 1000));

  return (
    <div>
      {seconds > 0 && <p className="mb-3 text-heist-yellow">Terminal cooling down · {seconds}s</p>}
      <Button type="submit" variant="outline" disabled={pending || seconds > 0} className="enabled:cursor-pointer">
        {pending ? 'Loading puzzle…' : 'Load replacement puzzle'}
      </Button>
    </div>
  );
}
