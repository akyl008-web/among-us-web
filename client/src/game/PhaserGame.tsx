import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { createGame, type GameStart } from './createGame';

interface PhaserGameProps {
  /** Must be stable (useMemo) — a new object re-creates the game. */
  start: GameStart;
}

/**
 * Mounts Phaser into a div and destroys it on unmount.
 *
 * React StrictMode mounts → unmounts → mounts effects synchronously in dev.
 * Phaser cannot reliably destroy a game that has not finished booting, so creating
 * it directly would leave a zombie game + second canvas. Creation is deferred by one
 * tick: StrictMode's instant re-mount cancels the first timer, so exactly one game exists.
 */
export default function PhaserGame({ start }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let game: Phaser.Game | null = null;
    const lifetime = new AbortController();
    const timer = window.setTimeout(() => {
      game = createGame(container, start, lifetime.signal);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      lifetime.abort();
      const current = game;
      if (!current) return;
      if (current.isBooted) current.destroy(true);
      else current.events.once(Phaser.Core.Events.READY, () => current.destroy(true));
    };
  }, [start]);

  return <div ref={containerRef} className="game-canvas" />;
}
