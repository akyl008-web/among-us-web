import type Phaser from 'phaser';
import type { PlayerColor } from '@stellar/shared';
import {
  characterAnimKey,
  characterTextureKey,
  ensureCharacterTexture,
} from '../art/characterTextures';

/** The sprite's (x, y) is the player's feet point — same as the server position. */
const FEET_ORIGIN_Y = 0.9;

/** Visual only: no physics. Position comes from prediction (local) or interpolation (remote). */
export class PlayerSprite {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private color: PlayerColor;
  private ghost = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    color: PlayerColor,
    name: string,
    isSelf: boolean,
  ) {
    ensureCharacterTexture(scene, color);
    this.color = color;
    this.sprite = scene.add
      .sprite(x, y, characterTextureKey(color), 'idle-0')
      .setOrigin(0.5, FEET_ORIGIN_Y);
    this.sprite.play(characterAnimKey(color, 'idle'));
    this.label = scene.add
      .text(x, y, name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: isSelf ? '#fde68a' : '#ffffff',
        stroke: '#0b0e1a',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1);
  }

  update(
    x: number,
    y: number,
    moving: boolean,
    facing: 1 | -1,
    ghost: boolean,
    nameColor?: string,
  ): void {
    this.sprite.setPosition(x, y);
    this.sprite.setFlipX(facing < 0);
    this.sprite.play(characterAnimKey(this.color, moving ? 'walk' : 'idle'), true);
    if (ghost !== this.ghost) {
      this.ghost = ghost;
      this.sprite.setAlpha(ghost ? 0.45 : 1);
      this.label.setAlpha(ghost ? 0.6 : 1);
    }
    if (nameColor) this.label.setColor(nameColor);
    this.sprite.setDepth(ghost ? 100_000 + y : y);
    this.label.setPosition(x, y - 56);
    this.label.setDepth(200_000 + y);
  }

  setColor(scene: Phaser.Scene, color: PlayerColor): void {
    if (color === this.color) return;
    ensureCharacterTexture(scene, color);
    this.color = color;
    this.sprite.setTexture(characterTextureKey(color), 'idle-0');
  }

  setName(name: string): void {
    if (this.label.text !== name) this.label.setText(name);
  }

  destroy(): void {
    this.sprite.destroy();
    this.label.destroy();
  }
}
