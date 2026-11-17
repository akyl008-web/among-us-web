import { useEffect, useRef } from 'react';
import type { GameBridge } from './bridge/GameBridge';
import { createGame } from './createGame';

interface PhaserGameProps {
  bridge: GameBridge;
}

/**
 * Mounts Phaser into a div and destroys it on unmount.
 * Safe under React StrictMode (double mount → destroy → mount).
 */
export default function PhaserGame({ bridge }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const game = createGame(container, bridge);
    return () => {
      game.destroy(true);
    };
  }, [bridge]);

  return <div ref={containerRef} className="game-canvas" />;
}
