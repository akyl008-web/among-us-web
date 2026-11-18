import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { PlayerColor } from '@stellar/shared';
import { createGameBridge } from '../../game/bridge/GameBridge';

const PhaserGame = lazy(() => import('../../game/PhaserGame'));

interface Props {
  name: string;
  color: PlayerColor;
  onExit: () => void;
}

/** Offline walk around the ship — for demos. Works even without the server. */
export function SoloScreen({ name, color, onExit }: Props) {
  const bridge = useMemo(() => createGameBridge(), []);
  const start = useMemo(
    () => ({ mode: 'solo' as const, bridge, name, color }),
    [bridge, name, color],
  );
  const [room, setRoom] = useState<string | null>(null);

  useEffect(() => bridge.on('game:location', ({ room: r }) => setRoom(r)), [bridge]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onExit();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  return (
    <div className="game-screen">
      <div className="game-stage">
        <Suspense fallback={<div className="game-loading">Загрузка корабля…</div>}>
          <PhaserGame start={start} />
        </Suspense>
        <div className="solo-bar panel panel--compact">
          <strong>Прогулка по кораблю</strong>
          <span className="muted">{room ?? 'Коридор'}</span>
          <span className="solo-keys">
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> — ходить
          </span>
          <button type="button" className="btn btn--small" onClick={onExit}>
            В меню <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
