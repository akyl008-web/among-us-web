import type Phaser from 'phaser';

/** TEMPORARY floor tile until the Tiled tileset lands in stage 3. */
export const FLOOR_TEXTURE_KEY = 'floor-tile';
export const FLOOR_TILE_SIZE = 64;

export function ensureEnvironmentTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(FLOOR_TEXTURE_KEY)) return;
  const s = FLOOR_TILE_SIZE;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x1a2036);
  g.fillRect(0, 0, s, s);
  g.fillStyle(0x1f2742);
  g.fillRect(2, 2, s / 2 - 3, s / 2 - 3);
  g.fillRect(s / 2 + 1, s / 2 + 1, s / 2 - 3, s / 2 - 3);
  g.lineStyle(2, 0x121729);
  g.strokeRect(0, 0, s, s);
  g.fillStyle(0x2c3657);
  for (const [x, y] of [
    [4, 4],
    [s - 4, 4],
    [4, s - 4],
    [s - 4, s - 4],
  ] as const) {
    g.fillCircle(x, y, 1.5);
  }
  g.generateTexture(FLOOR_TEXTURE_KEY, s, s);
  g.destroy();
}
