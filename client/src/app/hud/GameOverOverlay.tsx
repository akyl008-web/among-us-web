import type { RoomView } from '@stellar/shared';
import { errorText } from '../../net/errors';
import { useGameSession } from '../../net/useSession';
import { Avatar } from '../components/Avatar';

const REASONS = {
  TASKS: 'Экипаж выполнил все задания.',
  IMPOSTORS_ELIMINATED: 'Все предатели выброшены.',
  CREW_OUTNUMBERED: 'Предателей стало столько же, сколько экипажа.',
  REACTOR_MELTDOWN: 'Реактор взорвался.',
} as const;

export function GameOverOverlay({ room }: { room: RoomView }) {
  const session = useGameSession();
  const over = room.gameOver!;
  const myTeam = room.you.role === 'IMPOSTOR' ? 'IMPOSTORS' : 'CREW';
  const won = over.winner === myTeam;
  const isHost = room.hostId === room.you.id;

  const act = (fn: () => Promise<unknown>) =>
    fn().catch((err: unknown) => session.toast(errorText(err), 'danger'));

  return (
    <div className={`overlay gameover ${won ? 'gameover--win' : 'gameover--loss'}`}>
      <h1>{won ? 'Победа' : 'Поражение'}</h1>
      <p className="reveal-goal">
        {over.winner === 'CREW' ? 'Победил экипаж' : 'Победили предатели'} · {REASONS[over.reason]}
      </p>
      <div className="roles-reveal">
        {room.players.map((p) => (
          <div
            key={p.id}
            className={`role-card ${over.roles[p.id] === 'IMPOSTOR' ? 'role-card--impostor' : ''}`}
          >
            <Avatar color={p.color} size={46} dead={p.isDead} />
            <span>{p.name}</span>
            <small>{over.roles[p.id] === 'IMPOSTOR' ? 'Предатель' : 'Экипаж'}</small>
          </div>
        ))}
      </div>
      <div className="row">
        {isHost ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void act(() => session.returnToLobby())}
          >
            Вернуться в лобби
          </button>
        ) : (
          <span className="hint">Хост может вернуть всех в лобби.</span>
        )}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => void act(() => session.leaveRoom())}
        >
          Выйти в меню
        </button>
      </div>
    </div>
  );
}
