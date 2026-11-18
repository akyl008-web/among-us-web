import Phaser from 'phaser';
import {
  findRoomAt,
  getVelocity,
  isMoving,
  moveWithCollision,
  SKYWARD_MAP,
  type PlayerColor,
  type Vector2,
} from '@stellar/shared';
import type { GameBridge } from '../bridge/GameBridge';
import { PlayerSprite } from '../entities/PlayerSprite';
import { KeyboardInput } from '../input/KeyboardInput';
import { createShipMap } from '../world/shipMap';

export const SOLO_SCENE_KEY = 'SoloScene';

export interface SoloSceneData {
  bridge: GameBridge;
  color: PlayerColor;
  name: string;
}

/**
 * Offline free-roam mode: walk around the ship alone. No server, no roles.
 * Uses exactly the same map, collision and movement code as the online game.
 */
export class SoloScene extends Phaser.Scene {
  private data_!: SoloSceneData;
  private keyboard!: KeyboardInput;
  private player!: PlayerSprite;
  private pos: Vector2 = { x: 0, y: 0 };
  private facing: 1 | -1 = 1;
  private lastRoom: string | null | undefined;

  constructor() {
    super(SOLO_SCENE_KEY);
  }

  init(data: SoloSceneData): void {
    this.data_ = data;
  }

  create(): void {
    createShipMap(this);
    const spawn = SKYWARD_MAP.spawns[0]!;
    this.pos = { x: spawn.x, y: spawn.y };
    this.player = new PlayerSprite(this, spawn.x, spawn.y, this.data_.color, this.data_.name, true);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
    this.keyboard = new KeyboardInput(this);
    this.data_.bridge.emit('game:ready', { sceneKey: SOLO_SCENE_KEY });
  }

  override update(_time: number, delta: number): void {
    const input = this.keyboard.read();
    const v = getVelocity(input);
    const dt = Math.min(delta, 100) / 1000;
    this.pos = moveWithCollision(SKYWARD_MAP.grid, this.pos, v.x * dt, v.y * dt);
    if (v.x !== 0) this.facing = v.x > 0 ? 1 : -1;
    this.player.update(this.pos.x, this.pos.y, isMoving(input), this.facing, false);

    const room = findRoomAt(SKYWARD_MAP, this.pos);
    if (room !== this.lastRoom) {
      this.lastRoom = room;
      this.data_.bridge.emit('game:location', { room });
    }
  }
}
