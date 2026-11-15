export type Point = { x: number; y: number };
export type Rect = Point & { w: number; h: number };

export const width = 1200;
export const height = 570;
export const playerRadius = 15;

export const spawn = { x: 107, y: 473 };
export const exit = { x: 48, y: 489, w: 139, h: 51 };
export const fruit = { x: 1057, y: 250 };
export const door = { x: 921, y: 233, w: 20, h: 84 };
export const maintenanceGate = { x: 1013, y: 396, w: 82, h: 20 };
export const terminals = [
  { slot: 1, x: 208, y: 401 },
  { slot: 2, x: 325, y: 395 },
  { slot: 3, x: 801, y: 379 },
] as const;
export const doorControl = { x: 902, y: 275 };
export const vault = { x: 941, y: 145, w: 206, h: 251 };

export const covers = [
  { x: 48, y: 301, w: 196, h: 188, kind: 'shadow', label: 'STORAGE SHADOW' },
  { x: 716, y: 338, w: 171, h: 81, kind: 'shadow', label: 'SECURITY SHADOW' },
  { x: 947, y: 446, w: 200, h: 94, kind: 'shadow', label: 'VAULT SHADOW' },
  { x: 285, y: 365, w: 80, h: 64, kind: 'vent', label: 'HIDING VENT' },
] as const;

export const walls: Rect[] = [
  { x: 0, y: 0, w: width, h: 24 },
  { x: 0, y: height - 24, w: width, h: 24 },
  { x: 0, y: 0, w: 24, h: height },
  { x: width - 24, y: 0, w: 24, h: height },
  { x: 24, y: 24, w: 400, h: 32 },
  { x: 300, y: 180, w: 339, h: 35 },
  { x: 393, y: 419, w: 460, h: 34 },
  { x: 828, y: 80, w: 36, h: 163 },
  { x: 921, y: 125, w: 246, h: 20 },
  { x: 1147, y: 145, w: 20, h: 251 },
  { x: 921, y: 396, w: 92, h: 20 },
  { x: 1095, y: 396, w: 72, h: 20 },
  { x: 921, y: 145, w: 20, h: 88 },
  { x: 921, y: 317, w: 20, h: 79 },
];

export const crates: Rect[] = [
  { x: 61, y: 109, w: 57, h: 57 },
  { x: 134, y: 109, w: 57, h: 57 },
  { x: 61, y: 182, w: 57, h: 57 },
  { x: 571, y: 350, w: 54, h: 54 },
  { x: 642, y: 350, w: 54, h: 54 },
];

export const patrol = [
  { x: 415, y: 265 }, { x: 769, y: 265 }, { x: 769, y: 309 }, { x: 415, y: 309 },
];

export const camera = { x: 751, y: 56 };
