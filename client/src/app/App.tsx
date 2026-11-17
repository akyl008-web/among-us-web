import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { GAME_TITLE, MAX_PLAYERS } from '@stellar/shared';
import { createGameBridge } from '../game/bridge/GameBridge';
import { StatusPanel } from './StatusPanel';

// Phaser is heavy — load it in a separate chunk only when the game view mounts.
const PhaserGame = lazy(() => import('../game/PhaserGame'));

export function App() {
  const bridge = useMemo(() => createGameBridge(), []);
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => bridge.on('game:fps', ({ fps: value }) => setFps(value)), [bridge]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="logo">{GAME_TITLE}</h1>
        <span className="badge">Этап 1 · фундамент · до {MAX_PLAYERS} игроков</span>
      </header>
      <main className="app-main">
        <div className="game-frame">
          <Suspense fallback={<div className="game-loading">Загрузка движка…</div>}>
            <PhaserGame bridge={bridge} />
          </Suspense>
        </div>
        <StatusPanel fps={fps} />
      </main>
    </div>
  );
}
