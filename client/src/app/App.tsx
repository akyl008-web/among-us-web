import { useState } from 'react';
import type { PlayerColor } from '@stellar/shared';
import { useSessionState } from '../net/useSession';
import { Toasts } from './components/Toasts';
import { GameScreen } from './screens/GameScreen';
import { Lobby } from './screens/Lobby';
import { MainMenu } from './screens/MainMenu';
import { SoloScreen } from './screens/SoloScreen';

/** Screen routing is driven by server state: no room → menu, WAITING → lobby, else → game. */
export function App() {
  const { room, joined, connection } = useSessionState();
  const [solo, setSolo] = useState<{ name: string; color: PlayerColor } | null>(null);

  let screen;
  if (solo && !room) {
    return <SoloScreen name={solo.name} color={solo.color} onExit={() => setSolo(null)} />;
  } else if (!room) {
    screen =
      joined && connection !== 'disconnected' ? (
        <div className="center muted">Переподключение к комнате…</div>
      ) : (
        <MainMenu onSolo={(name, color) => setSolo({ name, color })} />
      );
  } else if (room.phase === 'WAITING') {
    screen = <Lobby room={room} />;
  } else {
    screen = <GameScreen room={room} />;
  }

  return (
    <div className="app">
      {connection === 'disconnected' && (
        <div className="connection-banner">Нет связи с сервером — переподключаемся…</div>
      )}
      {screen}
      <Toasts />
    </div>
  );
}
