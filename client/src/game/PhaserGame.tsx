import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import type { GameBridge } from './bridge/GameBridge';
import { createGame } from './createGame';

interface PhaserGameProps {
  bridge: GameBridge;
}

/**
 * Mounts Phaser into a div and destroys it on unmount.
 *
 * React StrictMode mounts → unmounts → mounts effects synchronously in dev.
 * Phaser cannot reliably destroy a game that has not finished booting, so creating
 * it directly would leave a zombie game + second canvas. Creation is deferred by one
 * tick: StrictMode's instant re-mount cancels the first timer, so exactly one game exists.
 */
export default function PhaserGame({ bridge }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let game: Phaser.Game | null = null;
    const timer = window.setTimeout(() => {
      game = createGame(container, bridge);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      const current = game;
      if (!current) return;
      if (current.isBooted) current.destroy(true);
      else current.events.once(Phaser.Core.Events.READY, () => current.destroy(true));
    };
  }, [bridge]);

  return <div ref={containerRef} className="game-canvas" />;
}
