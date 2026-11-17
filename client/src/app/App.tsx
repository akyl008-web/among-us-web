import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { GAME_TITLE, MAX_PLAYERS } from '@stellar/shared';
import { createGameBridge } from '../game/bridge/GameBridge';
import { StatusPanel, type GameStats } from './StatusPanel';

// Phaser is heavy — load it in a separate chunk only when the game view mounts.
const PhaserGame = lazy(() => import('../game/PhaserGame'));

export function App() {
  const bridge = useMemo(() => createGameBridge(), []);
  const [stats, setStats] = useState<GameStats>({ fps: null, position: null });

  useEffect(() => {
    const offFps = bridge.on('game:fps', ({ fps }) => setStats((s) => ({ ...s, fps })));
    const offPos = bridge.on('game:playerPosition', (position) =>
      setStats((s) => ({ ...s, position })),
    );
    return () => {
      offFps();
      offPos();
    };
  }, [bridge]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="logo">{GAME_TITLE}</h1>
        <span className="badge">Этап 2 · движение персонажа · до {MAX_PLAYERS} игроков</span>
      </header>
      <main className="app-main">
        <div className="game-frame">
          <Suspense fallback={<div className="game-loading">Загрузка движка…</div>}>
            <PhaserGame bridge={bridge} />
          </Suspense>
        </div>
        <aside className="sidebar">
          <StatusPanel stats={stats} />
          <section className="panel">
            <h2 className="panel-title">Управление</h2>
            <div className="controls">
              <span className="keys">
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd>
              </span>
              <span>или стрелки — движение</span>
            </div>
            <p className="hint">
              Отладка: <code>?debug</code> — хитбоксы, <code>?color=red</code> — цвет персонажа.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}
