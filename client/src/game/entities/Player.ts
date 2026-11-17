import Phaser from 'phaser';
import { getVelocity, isMoving, type MoveInput, type PlayerColor } from '@stellar/shared';
import {
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  characterAnimKey,
  characterTextureKey,
  ensureCharacterTexture,
} from '../art/characterTextures';

/** Collision box covers only the feet, so the head can overlap walls "behind" it (top-down depth). */
const HITBOX_WIDTH = 26;
const HITBOX_HEIGHT = 14;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly label: Phaser.GameObjects.Text;
  private readonly color: PlayerColor;

  constructor(scene: Phaser.Scene, x: number, y: number, color: PlayerColor, name: string) {
    ensureCharacterTexture(scene, color);
    super(scene, x, y, characterTextureKey(color), 'idle-0');
    this.color = color;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(HITBOX_WIDTH, HITBOX_HEIGHT);
    body.setOffset(
      (CHARACTER_FRAME_WIDTH - HITBOX_WIDTH) / 2,
      CHARACTER_FRAME_HEIGHT - HITBOX_HEIGHT - 4,
    );
    body.setCollideWorldBounds(true);

    this.label = scene.add
      .text(x, y, name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0b0e1a',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1);

    this.play(characterAnimKey(color, 'idle'));
    this.syncVisuals();
  }

  /** Applies a movement intent: velocity, facing and animation. */
  applyInput(input: MoveInput): void {
    const velocity = getVelocity(input);
    this.setVelocity(velocity.x, velocity.y);

    if (velocity.x < 0) this.setFlipX(true);
    else if (velocity.x > 0) this.setFlipX(false);

    const anim = isMoving(input) ? 'walk' : 'idle';
    this.play(characterAnimKey(this.color, anim), true);
  }

  /** Call once per frame after physics: keeps label attached and sorts by Y for top-down overlap. */
  syncVisuals(): void {
    this.setDepth(this.y);
    this.label.setPosition(this.x, this.y - CHARACTER_FRAME_HEIGHT / 2 - 2);
    this.label.setDepth(this.y + 10_000);
  }

  override destroy(fromScene?: boolean): void {
    this.label.destroy();
    super.destroy(fromScene);
  }
}
