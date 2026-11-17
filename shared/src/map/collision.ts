import type { Vector2 } from '../movement.js';

/** Solid/empty grid built from the map's colliding tiles. */
export interface CollisionGrid {
  width: number; // tiles
  height: number; // tiles
  tileSize: number; // px
  solid: Uint8Array; // 1 = blocked
}

/**
 * Player collision box around the "feet" point (x, y).
 * Small and wide so the head can visually overlap walls behind it.
 */
export const PLAYER_HALF_WIDTH = 11;
export const PLAYER_HALF_HEIGHT = 6;

export function isSolidTile(grid: CollisionGrid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return true; // outside = wall
  return grid.solid[ty * grid.width + tx] === 1;
}

export function isSolidAt(grid: CollisionGrid, x: number, y: number): boolean {
  return isSolidTile(grid, Math.floor(x / grid.tileSize), Math.floor(y / grid.tileSize));
}

/** True if the player box centred at (x, y) overlaps any solid tile. */
export function boxCollides(grid: CollisionGrid, x: number, y: number): boolean {
  const s = grid.tileSize;
  const left = Math.floor((x - PLAYER_HALF_WIDTH) / s);
  const right = Math.floor((x + PLAYER_HALF_WIDTH - 0.001) / s);
  const top = Math.floor((y - PLAYER_HALF_HEIGHT) / s);
  const bottom = Math.floor((y + PLAYER_HALF_HEIGHT - 0.001) / s);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolidTile(grid, tx, ty)) return true;
    }
  }
  return false;
}

/**
 * Moves by (dx, dy) resolving collisions per axis, so the player slides along walls.
 * Large moves are split into sub-steps to avoid tunnelling through thin walls.
 * Deterministic: client prediction and the authoritative server produce the same result.
 */
export function moveWithCollision(
  grid: CollisionGrid,
  from: Vector2,
  dx: number,
  dy: number,
): Vector2 {
  const maxStep = PLAYER_HALF_HEIGHT; // smaller than the thinnest wall
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / maxStep));
  const sx = dx / steps;
  const sy = dy / steps;
  let { x, y } = from;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0 && !boxCollides(grid, x + sx, y)) x += sx;
    if (sy !== 0 && !boxCollides(grid, x, y + sy)) y += sy;
  }
  return { x, y };
}

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
