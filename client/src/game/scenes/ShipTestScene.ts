import Phaser from 'phaser';
import type { PlayerColor } from '@stellar/shared';
import { FLOOR_TEXTURE_KEY } from '../art/environmentTextures';
import type { GameBridge } from '../bridge/GameBridge';
import { Player } from '../entities/Player';
import { KeyboardInput } from '../input/KeyboardInput';

export const SHIP_TEST_SCENE_KEY = 'ShipTestScene';

export interface ShipTestSceneData {
  bridge: GameBridge;
  color: PlayerColor;
}

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;
const WALL = 32;
const POSITION_EMIT_MS = 200;

/** [x, y, width, height] — TEMPORARY test walls; replaced by the Tiled map in stage 3. */
const TEST_WALLS: ReadonlyArray<readonly [number, number, number, number]> = [
  // hull
  [0, 0, WORLD_WIDTH, WALL],
  [0, WORLD_HEIGHT - WALL, WORLD_WIDTH, WALL],
  [0, 0, WALL, WORLD_HEIGHT],
  [WORLD_WIDTH - WALL, 0, WALL, WORLD_HEIGHT],
  // inner partitions with doorways
  [800, WALL, WALL, 500],
  [800, 700, WALL, 868],
  [1600, WALL, WALL, 900],
  [1600, 1100, WALL, 468],
  [WALL, 800, 500, WALL],
  [600, 800, 200, WALL],
  [1600, 600, 500, WALL],
  [2200, 600, 168, WALL],
  // obstacles (crates / consoles)
  [1100, 400, 160, 96],
  [1150, 1150, 96, 96],
  [350, 300, 128, 64],
];

/**
 * Stage 2 sandbox: local player with WASD movement, camera follow and wall collisions.
 * Network sync arrives in stage 6 — the scene only produces MoveInput intents.
 */
export class ShipTestScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private color: PlayerColor = 'cyan';
  private player!: Player;
  private keyboard!: KeyboardInput;
  private fpsTimer = 0;
  private positionTimer = 0;

  constructor() {
    super(SHIP_TEST_SCENE_KEY);
  }

  init(data: ShipTestSceneData): void {
    this.bridge = data.bridge;
    this.color = data.color;
    this.fpsTimer = 0;
    this.positionTimer = 0;
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.add
      .tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, FLOOR_TEXTURE_KEY)
      .setOrigin(0)
      .setDepth(-10);

    const walls = TEST_WALLS.map(([x, y, w, h]) => this.createWall(x, y, w, h));

    this.player = new Player(this, 400, 500, this.color, 'Вы');
    this.physics.add.collider(this.player, walls);

    this.keyboard = new KeyboardInput(this);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    camera.startFollow(this.player, true, 0.12, 0.12);
    camera.setDeadzone(80, 60);

    const offPause = this.bridge.on('ui:pause', ({ paused }) => {
      this.keyboard.setEnabled(!paused);
      if (paused) this.physics.pause();
      else this.physics.resume();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offPause);

    this.bridge.emit('game:ready', { sceneKey: SHIP_TEST_SCENE_KEY });
  }

  override update(_time: number, delta: number): void {
    this.player.applyInput(this.keyboard.read());
    this.player.syncVisuals();

    this.fpsTimer += delta;
    if (this.fpsTimer >= 1000) {
      this.fpsTimer = 0;
      this.bridge.emit('game:fps', { fps: Math.round(this.game.loop.actualFps) });
    }

    this.positionTimer += delta;
    if (this.positionTimer >= POSITION_EMIT_MS) {
      this.positionTimer = 0;
      this.bridge.emit('game:playerPosition', {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
      });
    }
  }

  private createWall(
    x: number,
    y: number,
    width: number,
    height: number,
  ): Phaser.GameObjects.Rectangle {
    // Wall face + lighter top edge for a little depth
    const wall = this.add
      .rectangle(x, y, width, height, 0x2e3a63)
      .setOrigin(0)
      .setDepth(y + height);
    wall.setStrokeStyle(2, 0x4c5b91);
    this.physics.add.existing(wall, true);
    return wall;
  }
}
