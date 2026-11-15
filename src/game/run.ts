import {
  camera, covers, crates, door, doorControl, exit, fruit, maintenanceGate, patrol, playerRadius, spawn, walls,
  type Point, type Rect,
} from './floor';

export type Outcome = 'extracted' | 'captured';
export type Visibility = 'exposed' | 'shadow' | 'vent';
type Action = 'extract' | 'empty-exit' | 'open-vault' | 'locked-vault' | 'collect';
type Sensor = Point & { angle: number; halfAngle: number; range: number };

export const movementKeys: Record<string, Point> = {
  w: { x: 0, y: -1 }, arrowup: { x: 0, y: -1 },
  s: { x: 0, y: 1 }, arrowdown: { x: 0, y: 1 },
  a: { x: -1, y: 0 }, arrowleft: { x: -1, y: 0 },
  d: { x: 1, y: 0 }, arrowright: { x: 1, y: 0 },
};

const stepSeconds = 1 / 60;
const alarmSeconds = 15;
const fixedObstacles = [...walls, ...crates];
const lockedObstacles = [...fixedObstacles, door, maintenanceGate];
const standardObstacles = [...fixedObstacles, maintenanceGate];
const fallbackObstacles = [...fixedObstacles, door];
const segments = patrol.map((start, index) => {
  const end = patrol[(index + 1) % patrol.length];
  return { start, end, length: distance(start, end), angle: Math.atan2(end.y - start.y, end.x - start.x) };
});
const patrolLength = segments.reduce((total, segment) => total + segment.length, 0);

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointInRect(point: Point, rect: Rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w &&
    point.y >= rect.y && point.y <= rect.y + rect.h;
}

function withMargin(rect: Rect, margin: number): Rect {
  return { x: rect.x - margin, y: rect.y - margin, w: rect.w + margin * 2, h: rect.h + margin * 2 };
}

export function rayDistance(origin: Point, direction: Point, range: number, obstacles: Rect[]) {
  let nearest = range;
  for (const rect of obstacles) {
    const offsetX = rect.x - origin.x;
    const offsetY = rect.y - origin.y;
    if ((direction.x === 0 && (offsetX > 0 || offsetX + rect.w < 0)) ||
        (direction.y === 0 && (offsetY > 0 || offsetY + rect.h < 0))) continue;

    const x1 = direction.x === 0 ? -Infinity : offsetX / direction.x;
    const x2 = direction.x === 0 ? Infinity : (offsetX + rect.w) / direction.x;
    const y1 = direction.y === 0 ? -Infinity : offsetY / direction.y;
    const y2 = direction.y === 0 ? Infinity : (offsetY + rect.h) / direction.y;
    const enter = Math.max(0, Math.min(x1, x2), Math.min(y1, y2));
    const leave = Math.min(Math.max(x1, x2), Math.max(y1, y2));
    if (leave >= enter) nearest = Math.min(nearest, enter);
  }
  return nearest;
}

function sees(sensor: Sensor, target: Point, obstacles: Rect[]) {
  const length = distance(sensor, target);
  if (length > sensor.range) return false;
  if (length === 0) return true;

  const direction = { x: (target.x - sensor.x) / length, y: (target.y - sensor.y) / length };
  const dot = direction.x * Math.cos(sensor.angle) + direction.y * Math.sin(sensor.angle);
  return dot >= Math.cos(sensor.halfAngle) && rayDistance(sensor, direction, length, obstacles) >= length;
}

export function createRun() {
  return {
    player: { ...spawn }, elapsed: 0, patrolDistance: 0, guardDetection: 0, cameraDetection: 0,
    cameraArmed: true, alarmUntil: 0, vaultOpen: false, maintenanceOpen: false, codeReady: false, hasFruit: false, outcome: null as Outcome | null,
    message: '', messageUntil: 0,
  };
}

export type Run = ReturnType<typeof createRun>;

export function obstaclesFor(run: Run) {
  if (run.maintenanceOpen) return fallbackObstacles;
  return run.vaultOpen ? standardObstacles : lockedObstacles;
}

export function visibilityFor(run: Run): Visibility {
  return covers.find((cover) => pointInRect(run.player, withMargin(cover, -playerRadius)))?.kind ?? 'exposed';
}

export function securityFor(run: Run): { guard: Sensor; camera: Sensor } {
  let remaining = run.patrolDistance % patrolLength;
  for (const segment of segments) {
    if (remaining < segment.length) {
      const fraction = remaining / segment.length;
      return {
        guard: {
          x: segment.start.x + (segment.end.x - segment.start.x) * fraction,
          y: segment.start.y + (segment.end.y - segment.start.y) * fraction,
          angle: segment.angle, halfAngle: 0.52, range: 194,
        },
        camera: { ...camera, angle: Math.PI / 2 + 0.68 * Math.sin(run.elapsed * 0.76), halfAngle: 0.34, range: 312 },
      };
    }
    remaining -= segment.length;
  }
  throw new Error('Invalid patrol position');
}

function move(run: Run, direction: Point, seconds: number) {
  const speed = 202 * seconds / (Math.hypot(direction.x, direction.y) || 1);
  const nextX = { ...run.player, x: run.player.x + direction.x * speed };
  const blocked = (point: Point) => obstaclesFor(run).some((wall) => pointInRect(point, withMargin(wall, playerRadius)));
  if (!blocked(nextX)) run.player.x = nextX.x;
  const nextY = { ...run.player, y: run.player.y + direction.y * speed };
  if (!blocked(nextY)) run.player.y = nextY.y;
}

function advanceClock(run: Run, seconds: number) {
  const alarmTime = Math.min(seconds, Math.max(0, run.alarmUntil - run.elapsed));
  run.patrolDistance = (run.patrolDistance + (seconds + alarmTime * 0.25) * 82) % patrolLength;
  run.elapsed += seconds;
}

export function advanceRun(run: Run, seconds: number, direction: Point) {
  if (!direction.x && !direction.y && visibilityFor(run) !== 'exposed' && !run.outcome) {
    advanceClock(run, seconds);
    run.guardDetection = Math.max(0, run.guardDetection - seconds * 1.8);
    run.cameraDetection = Math.max(0, run.cameraDetection - seconds * 1.8);
    if (run.cameraDetection === 0) run.cameraArmed = true;
    return;
  }

  while (seconds > 0 && !run.outcome) {
    const step = Math.min(seconds, stepSeconds);
    seconds -= step;
    advanceClock(run, step);
    if (direction.x || direction.y) move(run, direction, step);

    const exposed = visibilityFor(run) === 'exposed';
    const security = securityFor(run);
    const obstacles = obstaclesFor(run);
    const inGuardSight = exposed && sees(security.guard, run.player, obstacles);
    const inCameraSight = exposed && sees(security.camera, run.player, obstacles);
    run.guardDetection = detectionAfter(run.guardDetection, inGuardSight, step);
    run.cameraDetection = detectionAfter(run.cameraDetection, inCameraSight, step);

    if (run.guardDetection >= 1) run.outcome = 'captured';
    if (run.cameraDetection === 0) run.cameraArmed = true;
    if (run.cameraArmed && run.cameraDetection >= 1) {
      run.cameraArmed = false;
      run.alarmUntil = run.elapsed + alarmSeconds;
    }
  }
}

function detectionAfter(current: number, visible: boolean, seconds: number) {
  return Math.max(0, Math.min(1, current + (visible ? seconds : -seconds * 1.8)));
}

export function actionFor(run: Run): Action | null {
  if (pointInRect(run.player, withMargin(exit, 16))) return run.hasFruit ? 'extract' : 'empty-exit';
  if (!run.vaultOpen && distance(run.player, doorControl) <= 48) {
    return run.codeReady && !run.maintenanceOpen ? 'open-vault' : 'locked-vault';
  }
  if ((run.vaultOpen || run.maintenanceOpen) && !run.hasFruit && distance(run.player, fruit) <= 42) return 'collect';
  return null;
}

export function interact(run: Run) {
  if (run.outcome) return;
  switch (actionFor(run)) {
    case 'open-vault': run.vaultOpen = true; break;
    case 'locked-vault':
      showMessage(run, run.maintenanceOpen ? 'Use the south maintenance gate.' : 'Solve all three terminals first.');
      break;
    case 'collect': run.hasFruit = true; break;
    case 'extract': run.outcome = 'extracted'; break;
    case 'empty-exit': showMessage(run, 'Bring the fruit back to extract.'); break;
    case null: showMessage(run, 'Move closer to the objective to interact.'); break;
  }
}

function showMessage(run: Run, message: string) {
  run.message = message;
  run.messageUntil = run.elapsed + 2.5;
}
