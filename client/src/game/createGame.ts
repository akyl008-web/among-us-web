import Phaser from 'phaser';
import type { GameBridge } from './bridge/GameBridge';
import { BOOT_SCENE_KEY, BootScene } from './scenes/BootScene';
import { SHIP_TEST_SCENE_KEY, ShipTestScene } from './scenes/ShipTestScene';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Factory: the only place that knows the Phaser config. Add `?debug` to the URL to see hitboxes. */
export function createGame(parent: HTMLElement, bridge: GameBridge): Phaser.Game {
  const debug = new URLSearchParams(window.location.search).has('debug');

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0b0e1a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { debug, gravity: { x: 0, y: 0 } },
    },
    scene: [],
  });

  game.scene.add(SHIP_TEST_SCENE_KEY, ShipTestScene, false);
  game.scene.add(BOOT_SCENE_KEY, BootScene, true, { bridge });

  // Dev-only debugging handle: `window.__stellarGame` in the browser console.
  if (import.meta.env.DEV) {
    (window as unknown as { __stellarGame?: Phaser.Game }).__stellarGame = game;
  }
  return game;
}
