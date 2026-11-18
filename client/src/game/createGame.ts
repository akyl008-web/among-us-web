import Phaser from 'phaser';
import type { PlayerColor } from '@stellar/shared';
import type { GameSession } from '../net/GameSession';
import type { GameBridge } from './bridge/GameBridge';
import { BOOT_SCENE_KEY, BootScene, type BootData } from './scenes/BootScene';
import type { SceneDeps } from './scenes/sceneDeps';
import { SHIP_SCENE_KEY, ShipScene } from './scenes/ShipScene';
import { SOLO_SCENE_KEY, SoloScene, type SoloSceneData } from './scenes/SoloScene';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Which world to start: the online match or the offline free-roam walk. */
export type GameStart =
  | { mode: 'online'; bridge: GameBridge; session: GameSession }
  | { mode: 'solo'; bridge: GameBridge; color: PlayerColor; name: string };

/** Factory: the only place that knows the Phaser config. */
export function createGame(
  parent: HTMLElement,
  start: GameStart,
  signal: AbortSignal,
): Phaser.Game {
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
  game.scene.add(SOLO_SCENE_KEY, SoloScene, false);

  let boot: BootData;
  if (start.mode === 'online') {
    const deps: SceneDeps = { bridge: start.bridge, session: start.session, signal };
    boot = { next: SHIP_SCENE_KEY, data: deps };
  } else {
    const data: SoloSceneData = { bridge: start.bridge, color: start.color, name: start.name };
    boot = { next: SOLO_SCENE_KEY, data };
  }
  game.scene.add(BOOT_SCENE_KEY, BootScene, true, boot);

  // Dev-only debugging handle: `window.__stellarGame` in the browser console.
  if (import.meta.env.DEV) {
    (window as unknown as { __stellarGame?: Phaser.Game }).__stellarGame = game;
  }
  return game;
}
