import { SabotageType, TaskType } from '../protocol.js';
import type { Vector2 } from '../movement.js';
import type { CollisionGrid } from './collision.js';
import type {
  TiledMap,
  TiledObject,
  TiledObjectLayer,
  TiledProperty,
  TiledTileLayer,
} from './tiled.js';

export interface MapRoom {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapTask extends Vector2 {
  id: string;
  title: string;
  type: TaskType;
  room: string;
}

export interface MapSabotageStation extends Vector2 {
  id: string;
  sabotage: SabotageType;
}

/** Game-ready map: everything the server and client need, derived from the Tiled file. */
export interface GameMap {
  name: string;
  widthPx: number;
  heightPx: number;
  grid: CollisionGrid;
  rooms: MapRoom[];
  spawns: Vector2[];
  tasks: MapTask[];
  emergencyButton: Vector2;
  sabotageStations: MapSabotageStation[];
}

const COLLISION_LAYERS = ['walls', 'decor'];

function prop(
  props: TiledProperty[] | undefined,
  name: string,
): TiledProperty['value'] | undefined {
  return props?.find((p) => p.name === name)?.value;
}

function stringProp(obj: TiledObject, name: string): string {
  const value = prop(obj.properties, name);
  if (typeof value !== 'string') {
    throw new Error(`Map object "${obj.name}" (#${obj.id}) is missing string property "${name}"`);
  }
  return value;
}

function objectLayer(map: TiledMap, name: string): TiledObjectLayer {
  const layer = map.layers.find(
    (l): l is TiledObjectLayer => l.type === 'objectgroup' && l.name === name,
  );
  if (!layer) throw new Error(`Map is missing object layer "${name}"`);
  return layer;
}

function isEnumValue<T extends string>(values: Record<string, T>, value: string): value is T {
  return (Object.values(values) as string[]).includes(value);
}

/** Parses and validates a Tiled map. Throws a descriptive error on malformed data. */
export function parseGameMap(map: TiledMap): GameMap {
  if (map.tilewidth !== map.tileheight) throw new Error('Only square tiles are supported');
  const tileSize = map.tilewidth;

  // Colliding gids come from tileset tile properties (`collides: true`), editable in Tiled.
  const collidingGids = new Set<number>();
  for (const tileset of map.tilesets) {
    for (const tile of tileset.tiles ?? []) {
      if (prop(tile.properties, 'collides') === true) collidingGids.add(tileset.firstgid + tile.id);
    }
  }

  const solid = new Uint8Array(map.width * map.height);
  for (const layer of map.layers) {
    if (layer.type !== 'tilelayer' || !COLLISION_LAYERS.includes(layer.name)) continue;
    const data = (layer as TiledTileLayer).data;
    if (data.length !== solid.length) throw new Error(`Layer "${layer.name}" has wrong size`);
    data.forEach((gid, i) => {
      if (collidingGids.has(gid)) solid[i] = 1;
    });
  }
  // Empty space (no floor) is also solid.
  const floor = map.layers.find(
    (l): l is TiledTileLayer => l.type === 'tilelayer' && l.name === 'floor',
  );
  if (!floor) throw new Error('Map is missing tile layer "floor"');
  floor.data.forEach((gid, i) => {
    if (gid === 0) solid[i] = 1;
  });

  const rooms = objectLayer(map, 'rooms').objects.map((o) => ({
    name: o.name,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
  }));
  const spawns = objectLayer(map, 'spawns').objects.map((o) => ({ x: o.x, y: o.y }));

  const tasks: MapTask[] = [];
  const sabotageStations: MapSabotageStation[] = [];
  let emergencyButton: Vector2 | null = null;

  for (const obj of objectLayer(map, 'interactables').objects) {
    const kind = stringProp(obj, 'kind');
    if (kind === 'task') {
      const type = stringProp(obj, 'taskType');
      if (!isEnumValue(TaskType, type)) throw new Error(`Unknown task type "${type}"`);
      tasks.push({
        id: obj.name,
        title: stringProp(obj, 'title'),
        type,
        room: stringProp(obj, 'room'),
        x: obj.x,
        y: obj.y,
      });
    } else if (kind === 'emergency') {
      emergencyButton = { x: obj.x, y: obj.y };
    } else if (kind === 'sabotage-fix') {
      const sabotage = stringProp(obj, 'sabotage');
      if (!isEnumValue(SabotageType, sabotage)) throw new Error(`Unknown sabotage "${sabotage}"`);
      sabotageStations.push({ id: obj.name, sabotage, x: obj.x, y: obj.y });
    } else {
      throw new Error(`Unknown interactable kind "${kind}"`);
    }
  }

  if (!emergencyButton) throw new Error('Map has no emergency button');
  if (spawns.length === 0) throw new Error('Map has no spawn points');

  const nameProp = (map as TiledMap & { properties?: TiledProperty[] }).properties;
  return {
    name: String(prop(nameProp, 'name') ?? 'Unnamed'),
    widthPx: map.width * tileSize,
    heightPx: map.height * tileSize,
    grid: { width: map.width, height: map.height, tileSize, solid },
    rooms,
    spawns,
    tasks,
    emergencyButton,
    sabotageStations,
  };
}

export function findRoomAt(map: GameMap, point: Vector2): string | null {
  const room = map.rooms.find(
    (r) => point.x >= r.x && point.x < r.x + r.width && point.y >= r.y && point.y < r.y + r.height,
  );
  return room?.name ?? null;
}
