import type { GameSession } from '../../net/GameSession';
import type { GameBridge } from '../bridge/GameBridge';

/** What Phaser scenes get from the outside: the network session and the UI bridge. */
export interface SceneDeps {
  bridge: GameBridge;
  session: GameSession;
  /** Aborted by React when the game view unmounts — scenes unsubscribe on it. */
  signal: AbortSignal;
}
