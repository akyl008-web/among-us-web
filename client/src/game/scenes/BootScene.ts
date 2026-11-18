import Phaser from 'phaser';
import { SKYWARD_TILED } from '@stellar/shared';
import tilesetUrl from '@stellar/shared/maps/skyward-tiles.png?url';
import { ensureAllCharacterTextures } from '../art/characterTextures';
import { MAP_KEY, TILESET_KEY } from '../world/shipMap';

export const BOOT_SCENE_KEY = 'BootScene';

export interface BootData {
  /** Scene to start after loading (online ShipScene or offline SoloScene). */
  next: string;
  data: object;
}

/** Loads the Tiled map + tileset and generates character textures, then starts the world. */
export class BootScene extends Phaser.Scene {
  private boot!: BootData;

  constructor() {
    super(BOOT_SCENE_KEY);
  }

  init(data: BootData): void {
    this.boot = data;
  }

  preload(): void {
    // The Tiled JSON is bundled with the shared package (same file the server parses).
    this.load.tilemapTiledJSON(MAP_KEY, SKYWARD_TILED as unknown as object);
    this.load.image(TILESET_KEY, tilesetUrl);
  }

  create(): void {
    ensureAllCharacterTextures(this);
    this.scene.start(this.boot.next, this.boot.data);
  }
}
