import type Phaser from 'phaser';
import { SKYWARD_MAP } from '@stellar/shared';

export const MAP_KEY = 'skyward';
export const TILESET_KEY = 'skyward-tiles';

/**
 * Renders the Tiled ship map (layers, room labels, emergency button).
 * Shared by the online ShipScene and the offline SoloScene.
 */
export function createShipMap(scene: Phaser.Scene): void {
  const map = scene.make.tilemap({ key: MAP_KEY });
  const tiles = map.addTilesetImage('skyward-tiles', TILESET_KEY);
  if (!tiles) throw new Error('Tileset "skyward-tiles" not found in map');
  map.createLayer('floor', tiles)?.setDepth(-1000);
  map.createLayer('walls', tiles)?.setDepth(-900);
  map.createLayer('decor', tiles)?.setDepth(-800);

  for (const room of SKYWARD_MAP.rooms) {
    scene.add
      .text(room.x + room.width / 2, room.y + 18, room.name.toUpperCase(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.28)
      .setDepth(-700);
  }

  const b = SKYWARD_MAP.emergencyButton;
  scene.add.circle(b.x, b.y, 15, 0x7f1d1d).setDepth(-600);
  scene.add
    .circle(b.x, b.y - 2, 12, 0xef4444)
    .setDepth(-600)
    .setStrokeStyle(2, 0xfecaca);

  scene.cameras.main.setBounds(0, 0, SKYWARD_MAP.widthPx, SKYWARD_MAP.heightPx);
  scene.cameras.main.setBackgroundColor('#05070f');
}
