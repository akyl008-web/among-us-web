import Phaser from 'phaser';
import { PLAYER_COLORS, type PlayerColor } from '@stellar/shared';
import { PLAYER_COLOR_HEX, VISOR_COLOR, VISOR_GLOW } from './palette';

/**
 * TEMPORARY procedural art (keeps the project runnable without assets).
 * The designer can replace it with a sprite sheet: keep the same texture keys,
 * frame names and frame size, and nothing else in the game has to change.
 */
export const CHARACTER_FRAME_WIDTH = 48;
export const CHARACTER_FRAME_HEIGHT = 60;

export const CHARACTER_FRAMES = [
  'idle-0',
  'idle-1',
  'walk-0',
  'walk-1',
  'walk-2',
  'walk-3',
  'dead',
] as const;
type CharacterFrame = (typeof CHARACTER_FRAMES)[number];
type PoseFrame = Exclude<CharacterFrame, 'dead'>;

export const characterTextureKey = (color: PlayerColor) => `character-${color}`;
export const characterAnimKey = (color: PlayerColor, anim: 'idle' | 'walk') =>
  `character-${color}-${anim}`;

/** Per-frame pose: vertical body bob and left/right foot lift (px). */
const POSES: Record<PoseFrame, { bob: number; leftLift: number; rightLift: number }> = {
  'idle-0': { bob: 0, leftLift: 0, rightLift: 0 },
  'idle-1': { bob: 1, leftLift: 0, rightLift: 0 },
  'walk-0': { bob: 0, leftLift: 4, rightLift: 0 },
  'walk-1': { bob: 2, leftLift: 0, rightLift: 0 },
  'walk-2': { bob: 0, leftLift: 0, rightLift: 4 },
  'walk-3': { bob: 2, leftLift: 0, rightLift: 0 },
};

function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return amount >= 0 ? c.lighten(amount).color : c.darken(-amount).color;
}

/** Fallen robot (body left after elimination): lying capsule, cracked visor, sparks. */
function drawDeadFrame(g: Phaser.GameObjects.Graphics, ox: number, body: number) {
  const outline = shade(body, -45);
  const dark = shade(body, -20);
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(ox + 24, 52, 44, 10);
  g.fillStyle(outline);
  g.fillRoundedRect(ox + 3, 34, 42, 20, 9);
  g.fillStyle(dark);
  g.fillRoundedRect(ox + 5, 36, 38, 16, 7);
  g.fillStyle(body);
  g.fillRoundedRect(ox + 5, 36, 34, 12, 6);
  g.fillStyle(0x334155);
  g.fillRoundedRect(ox + 30, 38, 12, 8, 3);
  g.lineStyle(2, 0xe2e8f0);
  g.lineBetween(ox + 32, 39, ox + 38, 45);
  g.lineBetween(ox + 38, 39, ox + 32, 45);
  g.fillStyle(0xfacc15);
  g.fillTriangle(ox + 10, 30, ox + 14, 24, ox + 15, 31);
  g.fillTriangle(ox + 20, 29, ox + 23, 22, ox + 25, 30);
}

/** Draws one frame of the "astro-bot" at offset (ox, 0). Faces right; flipX for left. */
function drawFrame(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  body: number,
  frame: CharacterFrame,
) {
  if (frame === 'dead') {
    drawDeadFrame(g, ox, body);
    return;
  }
  const { bob, leftLift, rightLift } = POSES[frame];
  const outline = shade(body, -45);
  const dark = shade(body, -20);
  const light = shade(body, 25);
  const top = 6 + bob;

  // Ground shadow
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(ox + 24, 56, 30, 7);

  // Feet
  g.fillStyle(outline);
  g.fillRoundedRect(ox + 12, 46 - leftLift, 10, 10, 4);
  g.fillRoundedRect(ox + 26, 46 - rightLift, 10, 10, 4);

  // Antenna
  g.lineStyle(2, outline);
  g.lineBetween(ox + 20, top + 4, ox + 16, top - 3);
  g.fillStyle(0xfde047);
  g.fillCircle(ox + 16, top - 4, 3);

  // Body (rounded capsule) with outline and shading
  g.fillStyle(outline);
  g.fillRoundedRect(ox + 7, top + 2, 34, 42, 14);
  g.fillStyle(dark);
  g.fillRoundedRect(ox + 9, top + 4, 30, 38, 12);
  g.fillStyle(body);
  g.fillRoundedRect(ox + 9, top + 4, 27, 34, 12);
  g.fillStyle(light, 0.9);
  g.fillRoundedRect(ox + 12, top + 7, 6, 14, 3);

  // Visor band (faces right)
  g.fillStyle(outline);
  g.fillRoundedRect(ox + 19, top + 11, 22, 13, 6);
  g.fillStyle(VISOR_GLOW);
  g.fillRoundedRect(ox + 21, top + 13, 18, 9, 4);
  g.fillStyle(VISOR_COLOR);
  g.fillRoundedRect(ox + 23, top + 14, 9, 4, 2);

  // Chest light
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(ox + 30, top + 31, 2);
}

/** Generates a multi-frame texture + idle/walk animations for one color (idempotent). */
export function ensureCharacterTexture(scene: Phaser.Scene, color: PlayerColor): void {
  const key = characterTextureKey(color);
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    CHARACTER_FRAMES.forEach((frame, i) =>
      drawFrame(g, i * CHARACTER_FRAME_WIDTH, PLAYER_COLOR_HEX[color], frame),
    );
    g.generateTexture(key, CHARACTER_FRAME_WIDTH * CHARACTER_FRAMES.length, CHARACTER_FRAME_HEIGHT);
    g.destroy();

    const texture = scene.textures.get(key);
    CHARACTER_FRAMES.forEach((frame, i) =>
      texture.add(
        frame,
        0,
        i * CHARACTER_FRAME_WIDTH,
        0,
        CHARACTER_FRAME_WIDTH,
        CHARACTER_FRAME_HEIGHT,
      ),
    );
  }

  const idleKey = characterAnimKey(color, 'idle');
  if (!scene.anims.exists(idleKey)) {
    scene.anims.create({
      key: idleKey,
      frames: [
        { key, frame: 'idle-0' },
        { key, frame: 'idle-1' },
      ],
      frameRate: 2,
      repeat: -1,
    });
  }

  const walkKey = characterAnimKey(color, 'walk');
  if (!scene.anims.exists(walkKey)) {
    scene.anims.create({
      key: walkKey,
      frames: ['walk-0', 'walk-1', 'walk-2', 'walk-3'].map((frame) => ({ key, frame })),
      frameRate: 10,
      repeat: -1,
    });
  }
}

export function ensureAllCharacterTextures(scene: Phaser.Scene): void {
  for (const color of PLAYER_COLORS) ensureCharacterTexture(scene, color);
}
