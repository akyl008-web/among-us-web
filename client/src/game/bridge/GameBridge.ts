import { TypedEventEmitter } from '../../lib/TypedEventEmitter';
import type { Proximity } from '../world/proximity';

/**
 * Contract between React (UI) and Phaser (world).
 * React → Phaser: commands ("ui:*"). Phaser → React: notifications ("game:*").
 */
export interface GameBridgeEvents {
  [key: string]: unknown;
  'game:ready': { sceneKey: string };
  'game:proximity': Proximity;
  'game:location': { room: string | null };
  'ui:inputLocked': { locked: boolean };
}

export type GameBridge = TypedEventEmitter<GameBridgeEvents>;

export function createGameBridge(): GameBridge {
  return new TypedEventEmitter<GameBridgeEvents>();
}
