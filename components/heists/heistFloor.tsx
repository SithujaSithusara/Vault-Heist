'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { height, terminals, width } from '@/src/game/floor';
import { loadArt, renderRun } from '@/src/game/render';
import {actionFor, advanceRun, createRun, distance, interact, movementKeys, visibilityFor, type Run} from '@/src/game/run';

const desktop = '(min-width: 760px) and (pointer: fine)';
const stationary = { x: 0, y: 0 };

const prompts = {
  'open-vault': 'Open vault',
  'locked-vault': 'Check vault access',
  collect: 'Collect fruit',
  extract: 'Extract',
  'empty-exit': 'Check exit',
};

function nearbyTerminal(run: Run) {
  return terminals.find((terminal) => distance(run.player, terminal) <= 36)?.slot ?? null;
}

function readFloor(run: Run) {
  return {
    visibility: visibilityFor(run),
    terminal: nearbyTerminal(run),
    action: actionFor(run),
    guard: Math.round(run.guardDetection * 100),
    camera: Math.round(run.cameraDetection * 100),
    alarm: run.elapsed < run.alarmUntil,
    outcome: run.outcome,
    hasFruit: run.hasFruit,
    vaultOpen: run.vaultOpen,
    message: run.messageUntil > run.elapsed ? run.message : '',
  };
}

type HeistFloorProps = {
  playPath: string;
  selectedSlot: number;
  solvedSlots: number[];
  fallback: boolean;
  startedAtMs: number;
  puzzleAlarmUntilMs: number | null;
  children: ReactNode;
};

export function HeistFloor({
  playPath, selectedSlot, solvedSlots, fallback, startedAtMs, puzzleAlarmUntilMs, children,
}: HeistFloorProps) {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const run = useRef<Run | null>(null);
  const keys = useRef(new Set<string>());
  const [display, setDisplay] = useState(() => readFloor(createRun()));
  const [terminal, setTerminal] = useState<number | null>(null);

  function openNearbyObjective() {
    const current = run.current;
    if (!current || current.outcome || !matchMedia(desktop).matches || terminal !== null) return;

    const slot = nearbyTerminal(current);
    if (slot === null || fallback) {
      interact(current);
      return;
    }

    keys.current.clear();
    setTerminal(slot);
    if (slot !== selectedSlot) router.replace(playPath + '&terminal=' + slot, { scroll: false });
  }

  const onInteract = useEffectEvent(openNearbyObjective);
  const syncServerState = useEffectEvent((current: Run, now: number) => {
    if (fallback) current.vaultOpen = false;
    current.maintenanceOpen = fallback;
    current.codeReady = solvedSlots.length === terminals.length;

    const puzzleAlarm = Math.max(0, ((puzzleAlarmUntilMs ?? 0) - now) / 1000);
    if (puzzleAlarm > 0) current.alarmUntil = Math.max(current.alarmUntil, current.elapsed + puzzleAlarm);
    return solvedSlots;
  });

  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext('2d');
    if (!surface || !context) return;

    const media = matchMedia(desktop);
    const art = loadArt();
    const current = createRun();
    run.current = current;
    let lastTick = Date.now();
    let frame = 0;
    let lastDisplay = '';
    advanceRun(current, Math.max(0, (lastTick - startedAtMs) / 1000), stationary);

    function clearInput() {
      keys.current.clear();
    }

    function closeOnBlur() {
      clearInput();
      setTerminal(null);
    }

    function draw() {
      const now = Math.max(Date.now(), lastTick);
      const seconds = (now - lastTick) / 1000;
      let x = 0;
      let y = 0;
      if (seconds < 0.25 && !document.hidden && media.matches && document.activeElement === surface) {
        for (const key of keys.current) {
          x += movementKeys[key].x;
          y += movementKeys[key].y;
        }
      }

      const solved = syncServerState(current, lastTick);
      advanceRun(current, seconds, { x: Math.sign(x), y: Math.sign(y) });
      lastTick = now;

      const next = readFloor(current);
      const signature = JSON.stringify(next);
      if (signature !== lastDisplay) {
        lastDisplay = signature;
        setDisplay(next);
        if (next.outcome) setTerminal(null);
      }

      if (!document.hidden && media.matches) renderRun(context!, current, art, solved);
      frame = requestAnimationFrame(draw);
    }

    function keyDown(event: KeyboardEvent) {
      if (!media.matches || current.outcome || event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (Object.hasOwn(movementKeys, key)) {
        event.preventDefault();
        keys.current.add(key);
      } else if (key === 'e' && !event.repeat) {
        onInteract();
      }
    }

    function keyUp(event: KeyboardEvent) {
      keys.current.delete(event.key.toLowerCase());
    }

    surface.addEventListener('keydown', keyDown);
    surface.addEventListener('blur', clearInput);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', closeOnBlur);
    document.addEventListener('visibilitychange', closeOnBlur);
    media.addEventListener('change', closeOnBlur);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      surface.removeEventListener('keydown', keyDown);
      surface.removeEventListener('blur', clearInput);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', closeOnBlur);
      document.removeEventListener('visibilitychange', closeOnBlur);
      media.removeEventListener('change', closeOnBlur);
    };
  }, [startedAtMs]);

  useEffect(() => {
    const panel = dialog.current;
    if (!panel) return;
    if (terminal !== null && !fallback && !display.outcome) {
      if (!panel.open) panel.showModal();
    } else if (panel.open) {
      panel.close();
      if (document.hasFocus()) canvas.current?.focus({ preventScroll: true });
    }
  }, [terminal, fallback, display.outcome]);

  const objective = display.hasFruit ? 'Return to the exit'
    : display.vaultOpen ? 'Collect the fruit'
    : fallback ? 'Use the south maintenance gate'
    : solvedSlots.length === terminals.length ? 'Open the vault' : 'Solve the three terminals';
  const prompt = display.terminal !== null && !fallback ? 'Use Terminal ' + display.terminal
    : display.action ? prompts[display.action] : null;

  return (
    <>
      <p className="mt-5 min-[760px]:pointer-fine:hidden">Play on a desktop with a keyboard.</p>
      <div className="mt-5 hidden min-[760px]:pointer-fine:block">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">{objective}</p>
          <p className={display.alarm ? 'text-heist-red' : 'text-heist-mint'}>
            {display.alarm ? 'Alarm active' : display.visibility === 'exposed' ? 'Exposed'
              : display.visibility === 'vent' ? 'Hidden in vent' : 'Hidden in shadow'}
          </p>
        </div>
        <canvas
          ref={canvas}
          width={width}
          height={height}
          tabIndex={0}
          aria-label="The Banana Reserve game floor"
          aria-describedby="heist-controls"
          className="block h-auto w-full rounded-xl border-2 border-heist-edge bg-heist-bg focus-visible:outline-2 focus-visible:outline-heist-mint"
        />
        <div className="mt-3 flex min-h-10 flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <p id="heist-controls">Focus the floor. WASD or arrow keys to move. E to interact.</p>
          <label>Guard <progress className="w-16 accent-heist-red" value={display.guard} max={100} /></label>
          <label>Camera <progress className="w-16 accent-heist-yellow" value={display.camera} max={100} /></label>
          {prompt && !display.outcome && (
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => {
              canvas.current?.focus();
              openNearbyObjective();
            }}>
              {prompt}
            </Button>
          )}
        </div>
        {display.message && <p role="status" className="mt-2 text-heist-yellow">{display.message}</p>}
        {display.outcome && (
          <p role="status" className="mt-3 rounded-lg border border-heist-edge px-3 py-2 font-bold">
            {display.outcome === 'captured' ? 'The guard caught you.' : 'You escaped with the fruit.'}
          </p>
        )}
      </div>
      <dialog
        ref={dialog}
        aria-label={terminal ? 'Terminal ' + terminal : 'Terminal puzzle'}
        onCancel={(event) => { event.preventDefault(); setTerminal(null); }}
        className="fixed inset-y-0 right-4 left-auto m-auto max-h-[85svh] w-[min(35rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border-2 border-heist-edge bg-heist-panel p-5 text-heist-cream backdrop:bg-heist-ink/40"
      >
        <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setTerminal(null)}>
          Close terminal
        </Button>
        {terminal !== null && terminal === selectedSlot ? children : <p role="status">Loading terminal…</p>}
      </dialog>
    </>
  );
}
