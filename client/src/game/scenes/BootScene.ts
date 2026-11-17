import Phaser from 'phaser';
import { playerColorSchema, type PlayerColor } from '@stellar/shared';
import { ensureAllCharacterTextures } from '../art/characterTextures';
import { ensureEnvironmentTextures } from '../art/environmentTextures';
import type { GameBridge } from '../bridge/GameBridge';
import { SHIP_TEST_SCENE_KEY, type ShipTestSceneData } from './ShipTestScene';

export const BOOT_SCENE_KEY = 'BootScene';

/**
 * Prepares shared resources (textures, animations) and starts the world scene.
 * When real assets arrive, their `this.load.*` calls go into `preload()` here.
 */
export class BootScene extends Phaser.Scene {
  private bridge!: GameBridge;

  constructor() {
    super(BOOT_SCENE_KEY);
  }

  init(data: { bridge: GameBridge }): void {
    this.bridge = data.bridge;
  }

  create(): void {
    ensureEnvironmentTextures(this);
    ensureAllCharacterTextures(this);

    const sceneData: ShipTestSceneData = { bridge: this.bridge, color: readColorFromUrl() };
    this.scene.start(SHIP_TEST_SCENE_KEY, sceneData);
  }
}

/** Dev helper until the lobby exists (stage 4): `?color=red`. */
function readColorFromUrl(): PlayerColor {
  const parsed = playerColorSchema.safeParse(
    new URLSearchParams(window.location.search).get('color'),
  );
  return parsed.success ? parsed.data : 'cyan';
}
