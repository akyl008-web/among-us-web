import Phaser from 'phaser';
import type { GameBridge } from './bridge/GameBridge';
import { BOOT_SCENE_KEY, BootScene } from './scenes/BootScene';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Factory: the only place that knows the Phaser config. */
export function createGame(parent: HTMLElement, bridge: GameBridge): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0b0e1a',
    pixelArt: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scene: [],
  });
  game.scene.add(BOOT_SCENE_KEY, BootScene, true, { bridge });
  return game;
}
