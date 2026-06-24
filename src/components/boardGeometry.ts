export const CELL = 64;
export const PAD = 38;
export const VIEW_W = 8 * CELL + 2 * PAD;
export const VIEW_H = 9 * CELL + 2 * PAD;

export function vx(col: number): number {
  return PAD + col * CELL;
}

export function vy(row: number): number {
  return PAD + row * CELL;
}

export function px(col: number): number {
  return (vx(col) / VIEW_W) * 100;
}

export function py(row: number): number {
  return (vy(row) / VIEW_H) * 100;
}

export function displayCoord(col: number, row: number, flipped: boolean): { col: number; row: number } {
  return flipped ? { col: 8 - col, row: 9 - row } : { col, row };
}
