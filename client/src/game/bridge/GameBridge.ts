import { TypedEventEmitter } from '../../lib/TypedEventEmitter';

/**
 * Contract between React (UI) and Phaser (world).
 * React → Phaser: commands ("ui:*"). Phaser → React: notifications ("game:*").
 * Extend these maps as features are added; both sides stay decoupled.
 */
export interface GameBridgeEvents {
  [key: string]: unknown;
  'game:ready': { sceneKey: string };
  'game:fps': { fps: number };
  'ui:pause': { paused: boolean };
}

export type GameBridge = TypedEventEmitter<GameBridgeEvents>;

export function createGameBridge(): GameBridge {
  return new TypedEventEmitter<GameBridgeEvents>();
}
