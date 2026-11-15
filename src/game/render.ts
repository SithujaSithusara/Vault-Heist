import { camera, covers, crates, door, exit, fruit, height, maintenanceGate, patrol, playerRadius, terminals, vault, walls, width, type Rect } from './floor';
import { obstaclesFor, rayDistance, securityFor, visibilityFor, type Run } from './run';

type Art = { monkey: HTMLImageElement; banana: HTMLImageElement };
const ink = '#080f1b';
const cream = '#f6f4e8';
const mint = '#76e0b2';
const yellow = '#ffd45b';
const blue = '#8fd6ed';

export function loadArt(): Art {
  const monkey = new Image();
  monkey.src = '/art/miko-monkey.svg';
  const banana = new Image();
  banana.src = '/art/banana.svg';
  return { monkey, banana };
}

function plate(ctx: CanvasRenderingContext2D, box: Rect, fill: string, stroke: string, radius = 8) {
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = cream, size = 12) {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px "IBM Plex Mono", monospace`;
  ctx.fillText(text, x, y);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function cone(ctx: CanvasRenderingContext2D, sensor: ReturnType<typeof securityFor>['guard'], obstacles: Rect[], color: string) {
  ctx.beginPath();
  ctx.moveTo(sensor.x, sensor.y);
  for (let index = 0; index <= 64; index++) {
    const angle = sensor.angle + sensor.halfAngle * (index / 32 - 1);
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const length = rayDistance(sensor, direction, sensor.range, obstacles);
    ctx.lineTo(sensor.x + direction.x * length, sensor.y + direction.y * length);
  }
  ctx.closePath();
  ctx.fillStyle = `${color}32`;
  ctx.strokeStyle = `${color}82`;
  ctx.lineWidth = 1.4;
  ctx.fill();
  ctx.stroke();
}

function drawFloor(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#304c56';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#3b5862';
  ctx.lineWidth = 1;
  for (let x = 24; x < width; x += 48) line(ctx, x + 0.5, 24, x + 0.5, height - 24);
  for (let y = 24; y < height; y += 48) line(ctx, 24, y + 0.5, width - 24, y + 0.5);

  ctx.save();
  ctx.strokeStyle = '#6e8992';
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  patrol.forEach(({ x, y }) => ctx.lineTo(x, y));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  label(ctx, 'STORAGE', 61, 90, '#a6bac1');
  label(ctx, 'SECURITY', 487, 153, '#a6bac1');
  plate(ctx, vault, '#203747', ink, 0);
  label(ctx, 'FRUIT VAULT', 995, 180, yellow);
  plate(ctx, { x: 993, y: 194, w: 128, h: 124 }, '#294952', '#45646b', 22);
  plate(ctx, { x: 1004, y: 205, w: 106, h: 102 }, '#172938', '#42626b', 17);

  for (const cover of covers) {
    plate(ctx, cover, '#142737', '#63b99c', 10);
    if (cover.kind === 'vent') {
      for (let index = 0; index < 3; index++) {
        plate(ctx, { x: cover.x + 19, y: cover.y + 12 + index * 9, w: 42, h: 3 }, '#6b9196', '#385963', 1);
      }
      label(ctx, cover.label, cover.x - 1, cover.y + cover.h + 16, mint, 11);
    } else {
      label(ctx, cover.label, cover.x + 12, cover.y + 18, mint, 11);
    }
  }

  plate(ctx, exit, mint, ink);
  label(ctx, '< EXIT', exit.x + 39, exit.y + 32, ink, 18);
}

export function renderRun(ctx: CanvasRenderingContext2D, run: Run, art: Art, solvedSlots: readonly number[]) {
  drawFloor(ctx);
  const { guard, camera: cameraSensor } = securityFor(run);
  const obstacles = obstaclesFor(run);
  const alarm = run.alarmUntil > run.elapsed;
  cone(ctx, cameraSensor, obstacles, alarm ? '#ff7278' : blue);
  cone(ctx, guard, obstacles, alarm ? '#ff7278' : yellow);

  for (const wall of walls) {
    plate(ctx, wall, '#1a2d3c', ink, 6);
    ctx.strokeStyle = '#38505d';
    line(ctx, wall.x + 7, wall.y + 5, wall.x + wall.w - 7, wall.y + 5);
  }

  for (const crate of crates) {
    plate(ctx, crate, '#243f4e', ink);
    ctx.strokeStyle = '#496a75';
    ctx.lineWidth = 5;
    line(ctx, crate.x + 8, crate.y + 8, crate.x + crate.w - 8, crate.y + crate.h - 8);
    line(ctx, crate.x + crate.w - 8, crate.y + 8, crate.x + 8, crate.y + crate.h - 8);
  }

  for (const terminal of terminals) {
    const solved = solvedSlots.includes(terminal.slot);
    const accent = solved ? mint : blue;
    plate(ctx, { x: terminal.x - 16, y: terminal.y - 14, w: 32, h: 28 }, '#172938', accent);
    label(ctx, String(terminal.slot), terminal.x - 4, terminal.y + 4, accent);
  }

  if (!run.maintenanceOpen) plate(ctx, maintenanceGate, '#344d55', yellow, 4);
  label(ctx, 'MAINTENANCE', maintenanceGate.x, maintenanceGate.y + 38, run.maintenanceOpen ? mint : yellow, 11);

  if (!run.vaultOpen) {
    plate(ctx, door, '#344d55', yellow, 4);
    for (let y = door.y + 10; y < door.y + door.h; y += 10) {
      ctx.strokeStyle = '#8f7544';
      ctx.lineWidth = 1;
      line(ctx, door.x + 4, y, door.x + door.w - 4, y);
    }
  }
  plate(ctx, { x: 902, y: 264, w: 12, h: 22 }, run.vaultOpen ? mint : yellow, ink, 3);
  if (!run.hasFruit && art.banana.naturalWidth) ctx.drawImage(art.banana, fruit.x - 32, fruit.y - 32, 64, 64);
  if (run.hasFruit) label(ctx, 'EMPTY', fruit.x - 21, fruit.y + 5, '#a6bac1');

  plate(ctx, { x: camera.x - 13, y: camera.y - 9, w: 26, h: 18 }, '#152835', blue, 4);
  label(ctx, 'CAM 01', camera.x + 20, camera.y + 4, blue, 11);
  ctx.save();
  ctx.translate(guard.x, guard.y);
  ctx.rotate(guard.angle);
  plate(ctx, { x: -17, y: -16, w: 34, h: 32 }, '#ff7278', ink, 12);
  plate(ctx, { x: 3, y: -12, w: 13, h: 24 }, '#253d4b', ink, 5);
  ctx.strokeStyle = blue;
  ctx.lineWidth = 3;
  line(ctx, 9, -6, 9, 6);
  ctx.restore();

  const player = run.player;
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 11, playerRadius + 2, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#080f1b9c';
  ctx.fill();
  ctx.strokeStyle = visibilityFor(run) === 'exposed' ? yellow : mint;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (art.monkey.naturalWidth) ctx.drawImage(art.monkey, player.x - 35, player.y - 37, 70, 70);
  label(ctx, 'YOU', player.x - 10, player.y + 30, cream, 11);
}
