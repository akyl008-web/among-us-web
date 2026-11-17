import { describe, expect, it } from 'vitest';
import {
  getMoveDirection,
  getVelocity,
  IDLE_INPUT,
  isMoving,
  PLAYER_SPEED,
  stepPosition,
} from './movement.js';

const input = (keys: Partial<typeof IDLE_INPUT>) => ({ ...IDLE_INPUT, ...keys });

describe('movement', () => {
  it('is idle with no keys', () => {
    expect(getMoveDirection(IDLE_INPUT)).toEqual({ x: 0, y: 0 });
    expect(isMoving(IDLE_INPUT)).toBe(false);
  });

  it('moves straight at full speed', () => {
    expect(getVelocity(input({ right: true }))).toEqual({ x: PLAYER_SPEED, y: 0 });
    expect(getVelocity(input({ up: true }))).toEqual({ x: 0, y: -PLAYER_SPEED });
  });

  it('normalizes diagonal movement', () => {
    const v = getVelocity(input({ down: true, left: true }));
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(PLAYER_SPEED);
    expect(v.x).toBeLessThan(0);
    expect(v.y).toBeGreaterThan(0);
  });

  it('cancels opposite keys', () => {
    expect(isMoving(input({ left: true, right: true }))).toBe(false);
    expect(getMoveDirection(input({ up: true, down: true, right: true }))).toEqual({ x: 1, y: 0 });
  });

  it('steps position by elapsed time and ignores negative delta', () => {
    expect(stepPosition({ x: 0, y: 0 }, input({ right: true }), 500, 100)).toEqual({ x: 50, y: 0 });
    expect(stepPosition({ x: 5, y: 5 }, input({ right: true }), -16)).toEqual({ x: 5, y: 5 });
  });
});
