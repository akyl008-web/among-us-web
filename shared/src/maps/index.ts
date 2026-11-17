import { parseGameMap, type GameMap } from '../map/gameMap.js';
import type { TiledMap } from '../map/tiled.js';
import skywardJson from './skyward.json' with { type: 'json' };

/** Raw Tiled JSON — the client renders it with Phaser's tilemap loader. */
export const SKYWARD_TILED: TiledMap = skywardJson as TiledMap;

/** Parsed map — collisions, rooms, spawns and interactables for server and client logic. */
export const SKYWARD_MAP: GameMap = parseGameMap(SKYWARD_TILED);
