import Phaser from 'phaser';
import { SKYWARD_TILED } from '@stellar/shared';
import tilesetUrl from '@stellar/shared/maps/skyward-tiles.png?url';
import { ensureAllCharacterTextures } from '../art/characterTextures';
import type { SceneDeps } from './sceneDeps';
import { SHIP_SCENE_KEY } from './ShipScene';

export const BOOT_SCENE_KEY = 'BootScene';
export const MAP_KEY = 'skyward';
export const TILESET_KEY = 'skyward-tiles';

/** Loads the Tiled map + tileset and generates character textures, then starts the world. */
export class BootScene extends Phaser.Scene {
  private deps!: SceneDeps;

  constructor() {
    super(BOOT_SCENE_KEY);
  }

  init(data: SceneDeps): void {
    this.deps = data;
  }

  preload(): void {
    // The Tiled JSON is bundled with the shared package (same file the server parses).
    this.load.tilemapTiledJSON(MAP_KEY, SKYWARD_TILED as unknown as object);
    this.load.image(TILESET_KEY, tilesetUrl);
  }

  create(): void {
    ensureAllCharacterTextures(this);
    this.scene.start(SHIP_SCENE_KEY, this.deps);
  }
}
