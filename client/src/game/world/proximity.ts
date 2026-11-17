import {
  distance,
  INTERACT_RANGE,
  KILL_RANGE,
  REPORT_RANGE,
  Role,
  type GameMap,
  type RoomView,
  type TaskType,
  type Vector2,
} from '@stellar/shared';

export type UseTarget =
  | { kind: 'task'; taskId: string; title: string; type: TaskType }
  | { kind: 'emergency' }
  | { kind: 'sabotage'; stationId: string };

export interface Proximity {
  use: UseTarget | null;
  reportBodyId: string | null;
  killTargetId: string | null;
}

export const NO_PROXIMITY: Proximity = { use: null, reportBodyId: null, killTargetId: null };

interface Positioned extends Vector2 {
  id: string;
}

/**
 * UX helper: which actions are available right now (enables HUD buttons).
 * The server re-validates everything — this never grants permission by itself.
 */
export function computeProximity(
  me: Vector2,
  room: RoomView,
  map: GameMap,
  others: Positioned[],
  bodies: (Vector2 & { ownerId: string })[],
): Proximity {
  if (!room.you.alive || room.phase !== 'PLAYING') return NO_PROXIMITY;

  const candidates: { target: UseTarget; d: number }[] = [];
  if (room.you.role === Role.CREWMATE) {
    for (const own of room.you.tasks) {
      if (own.done) continue;
      const task = map.tasks.find((t) => t.id === own.id);
      if (!task) continue;
      const d = distance(me, task);
      if (d <= INTERACT_RANGE)
        candidates.push({
          target: { kind: 'task', taskId: task.id, title: task.title, type: task.type },
          d,
        });
    }
  }
  if (room.sabotage) {
    for (const station of map.sabotageStations) {
      if (
        station.sabotage !== room.sabotage.type ||
        room.sabotage.fixedStationIds.includes(station.id)
      )
        continue;
      const d = distance(me, station);
      if (d <= INTERACT_RANGE)
        candidates.push({ target: { kind: 'sabotage', stationId: station.id }, d: d - 1000 }); // priority
    }
  } else if (room.you.emergencyLeft > 0) {
    const d = distance(me, map.emergencyButton);
    if (d <= INTERACT_RANGE) candidates.push({ target: { kind: 'emergency' }, d });
  }
  candidates.sort((a, b) => a.d - b.d);

  const nearest = <T extends Vector2>(items: T[], range: number): T | null => {
    let best: T | null = null;
    let bestD = range;
    for (const item of items) {
      const d = distance(me, item);
      if (d <= bestD) {
        best = item;
        bestD = d;
      }
    }
    return best;
  };

  const body = nearest(bodies, REPORT_RANGE);
  let killTargetId: string | null = null;
  if (room.you.role === Role.IMPOSTOR) {
    const victims = others.filter((o) => !room.impostorIds.includes(o.id));
    killTargetId = nearest(victims, KILL_RANGE)?.id ?? null;
  }

  return { use: candidates[0]?.target ?? null, reportBodyId: body?.ownerId ?? null, killTargetId };
}

export function sameProximity(a: Proximity, b: Proximity): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
