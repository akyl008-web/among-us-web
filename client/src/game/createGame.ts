import Phaser from 'phaser';
import { BOOT_SCENE_KEY, BootScene } from './scenes/BootScene';
import type { SceneDeps } from './scenes/sceneDeps';
import { SHIP_SCENE_KEY, ShipScene } from './scenes/ShipScene';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Factory: the only place that knows the Phaser config. */
export function createGame(parent: HTMLElement, deps: SceneDeps): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#05070f',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Keyboard events are read from window; never steal focus from React inputs.
    input: { keyboard: { target: window } },
    scene: [],
  });

  game.scene.add(SHIP_SCENE_KEY, ShipScene, false);
  game.scene.add(BOOT_SCENE_KEY, BootScene, true, deps);

  // Dev-only debugging handle: `window.__stellarGame` in the browser console.
  if (import.meta.env.DEV) {
    (window as unknown as { __stellarGame?: Phaser.Game }).__stellarGame = game;
  }
  return game;
}
