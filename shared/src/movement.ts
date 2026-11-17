/**
 * Pure movement math shared by client (prediction/rendering) and server
 * (authoritative simulation, stage 6). No Phaser, no Socket.IO here.
 */

/** Player walking speed in world pixels per second. */
export const PLAYER_SPEED = 220;

/** Directional intent. This is what the client will send to the server — never a position. */
export interface MoveInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface Vector2 {
  x: number;
  y: number;
}

export const IDLE_INPUT: Readonly<MoveInput> = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
});

/**
 * Converts pressed keys into a unit direction vector.
 * Opposite keys cancel out; diagonals are normalized so moving
 * diagonally is not ~41% faster than moving straight.
 */
export function getMoveDirection(input: MoveInput): Vector2 {
  const x = Number(input.right) - Number(input.left);
  const y = Number(input.down) - Number(input.up);
  if (x === 0 && y === 0) return { x: 0, y: 0 };
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

/** Velocity in px/s for the given input. */
export function getVelocity(input: MoveInput, speed: number = PLAYER_SPEED): Vector2 {
  const dir = getMoveDirection(input);
  return { x: dir.x * speed, y: dir.y * speed };
}

/** Advances a position by `deltaMs` (no collision — collisions are resolved by the map layer). */
export function stepPosition(
  position: Vector2,
  input: MoveInput,
  deltaMs: number,
  speed: number = PLAYER_SPEED,
): Vector2 {
  const velocity = getVelocity(input, speed);
  const seconds = Math.max(0, deltaMs) / 1000;
  return { x: position.x + velocity.x * seconds, y: position.y + velocity.y * seconds };
}

export function isMoving(input: MoveInput): boolean {
  const dir = getMoveDirection(input);
  return dir.x !== 0 || dir.y !== 0;
}
