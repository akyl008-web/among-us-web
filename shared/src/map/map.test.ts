import { describe, expect, it } from 'vitest';
import { SKYWARD_MAP } from '../maps/index.js';
import { boxCollides, isSolidTile, moveWithCollision, type CollisionGrid } from './collision.js';
import { findRoomAt } from './gameMap.js';

const REQUIRED_ROOMS = [
  'Cafeteria',
  'Electrical',
  'MedBay',
  'Reactor',
  'Navigation',
  'Storage',
  'Security',
];

/** Flood fill over walkable tiles starting from a pixel point. */
function reachableTiles(grid: CollisionGrid, from: { x: number; y: number }): Set<number> {
  const start =
    Math.floor(from.y / grid.tileSize) * grid.width + Math.floor(from.x / grid.tileSize);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const i = queue.pop()!;
    const x = i % grid.width;
    const y = Math.floor(i / grid.width);
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const n = ny * grid.width + nx;
      if (!isSolidTile(grid, nx, ny) && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

describe('Skyward map', () => {
  const map = SKYWARD_MAP;
  const tileIndex = (p: { x: number; y: number }) =>
    Math.floor(p.y / map.grid.tileSize) * map.grid.width + Math.floor(p.x / map.grid.tileSize);

  it('contains all required rooms', () => {
    expect(map.rooms.map((r) => r.name).sort()).toEqual([...REQUIRED_ROOMS].sort());
  });

  it('has enough spawn points for a full room and they are free', () => {
    expect(map.spawns.length).toBeGreaterThanOrEqual(10);
    for (const s of map.spawns) expect(boxCollides(map.grid, s.x, s.y)).toBe(false);
  });

  it('places every task inside its room and on a walkable tile', () => {
    expect(map.tasks.length).toBeGreaterThanOrEqual(8);
    for (const t of map.tasks) {
      expect(findRoomAt(map, t), t.id).toBe(t.room);
      expect(boxCollides(map.grid, t.x, t.y), t.id).toBe(false);
    }
  });

  it('makes every interactable reachable from the spawn', () => {
    const reachable = reachableTiles(map.grid, map.spawns[0]!);
    const points = [...map.tasks, ...map.sabotageStations, ...map.spawns];
    for (const p of points) expect(reachable.has(tileIndex(p))).toBe(true);
    // emergency button sits on a table: a neighbouring tile must be reachable
    const b = map.emergencyButton;
    const near = [
      { x: b.x - 48, y: b.y },
      { x: b.x + 48, y: b.y },
      { x: b.x, y: b.y + 48 },
    ].some((p) => reachable.has(tileIndex(p)));
    expect(near).toBe(true);
  });

  it('has sabotage stations for lights and both reactor panels', () => {
    expect(map.sabotageStations.filter((s) => s.sabotage === 'REACTOR')).toHaveLength(2);
    expect(map.sabotageStations.filter((s) => s.sabotage === 'LIGHTS')).toHaveLength(1);
  });
});

describe('collision', () => {
  // 5x5 grid with a wall column at x = 2
  const grid: CollisionGrid = {
    width: 5,
    height: 5,
    tileSize: 32,
    solid: Uint8Array.from({ length: 25 }, (_, i) => (i % 5 === 2 ? 1 : 0)),
  };

  it('stops at walls and slides along them', () => {
    const end = moveWithCollision(grid, { x: 40, y: 80 }, 200, 20);
    expect(end.x).toBeLessThan(64 - 10); // blocked before the wall column
    expect(end.y).toBeCloseTo(100); // vertical part of the move still applied
  });

  it('does not tunnel through a wall on a huge step', () => {
    const end = moveWithCollision(grid, { x: 40, y: 80 }, 1000, 0);
    expect(end.x).toBeLessThan(64);
  });

  it('treats out-of-bounds as solid', () => {
    expect(isSolidTile(grid, -1, 0)).toBe(true);
    expect(isSolidTile(grid, 0, 5)).toBe(true);
  });
});
