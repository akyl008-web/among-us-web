import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_SETTINGS, SKYWARD_MAP, type RoomView } from '@stellar/shared';
import { INTERP_DELAY_MS, Interpolator } from './Interpolator';
import { computeProximity } from './proximity';

describe('Interpolator', () => {
  it('interpolates between samples in the past', () => {
    const i = new Interpolator();
    i.push(0, 0, 1000);
    i.push(100, 0, 1100);
    expect(i.sample(1050 + INTERP_DELAY_MS)).toEqual({ x: 50, y: 0 });
    expect(i.sample(5000)).toEqual({ x: 100, y: 0 });
    expect(i.sample(0)).toEqual({ x: 0, y: 0 });
  });
});

const baseRoom = (patch: Partial<RoomView['you']>, extra: Partial<RoomView> = {}): RoomView => ({
  code: 'ABCDEF',
  phase: 'PLAYING',
  hostId: 'a',
  settings: { ...DEFAULT_ROOM_SETTINGS },
  minPlayers: 4,
  players: [],
  you: {
    id: 'me',
    role: 'CREWMATE',
    alive: true,
    tasks: [],
    fakeTasks: false,
    emergencyLeft: 1,
    killCooldownMs: null,
    sabotageCooldownMs: null,
    activeTaskId: null,
    ...patch,
  },
  impostorIds: [],
  taskProgress: { done: 0, total: 0 },
  startingRemainingMs: null,
  meeting: null,
  result: null,
  sabotage: null,
  gameOver: null,
  ...extra,
});

describe('computeProximity', () => {
  const task = SKYWARD_MAP.tasks[0]!;

  it('offers own unfinished task in range', () => {
    const room = baseRoom({ tasks: [{ id: task.id, done: false }] });
    expect(computeProximity(task, room, SKYWARD_MAP, [], []).use).toMatchObject({
      kind: 'task',
      taskId: task.id,
    });
    const done = baseRoom({ tasks: [{ id: task.id, done: true }] });
    expect(computeProximity(task, done, SKYWARD_MAP, [], []).use).toBeNull();
  });

  it('offers kills only to impostors and never on teammates', () => {
    const others = [
      { id: 'mate', x: 10, y: 0 },
      { id: 'crew', x: 30, y: 0 },
    ];
    const imp = baseRoom({ role: 'IMPOSTOR' }, { impostorIds: ['me', 'mate'] });
    expect(computeProximity({ x: 0, y: 0 }, imp, SKYWARD_MAP, others, []).killTargetId).toBe(
      'crew',
    );
    expect(
      computeProximity({ x: 0, y: 0 }, baseRoom({}), SKYWARD_MAP, others, []).killTargetId,
    ).toBeNull();
  });

  it('gives ghosts no actions', () => {
    const room = baseRoom({ alive: false, tasks: [{ id: task.id, done: false }] });
    expect(
      computeProximity(task, room, SKYWARD_MAP, [], [{ ownerId: 'x', x: task.x, y: task.y }]),
    ).toEqual({
      use: null,
      reportBodyId: null,
      killTargetId: null,
    });
  });
});
