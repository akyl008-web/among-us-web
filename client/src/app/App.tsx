import { useSessionState } from '../net/useSession';
import { Toasts } from './components/Toasts';
import { GameScreen } from './screens/GameScreen';
import { Lobby } from './screens/Lobby';
import { MainMenu } from './screens/MainMenu';

/** Screen routing is driven by server state: no room → menu, WAITING → lobby, else → game. */
export function App() {
  const { room, joined, connection } = useSessionState();

  let screen;
  if (!room) {
    screen =
      joined && connection !== 'disconnected' ? (
        <div className="center muted">Переподключение к комнате…</div>
      ) : (
        <MainMenu />
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
