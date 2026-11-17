import type { RoomView } from '@stellar/shared';
import { useSessionState } from '../../net/useSession';
import { Avatar } from '../components/Avatar';
import { useCountdown } from '../components/useCountdown';

export function RoleReveal({ room }: { room: RoomView }) {
  const { roomReceivedAt } = useSessionState();
  const seconds = useCountdown(room.startingRemainingMs, roomReceivedAt);
  const impostor = room.you.role === 'IMPOSTOR';
  const team = room.players.filter((p) => room.impostorIds.includes(p.id));

  return (
    <div className={`overlay reveal ${impostor ? 'reveal--impostor' : 'reveal--crew'}`}>
      <p className="muted">Ваша роль</p>
      <h1>{impostor ? 'Предатель' : 'Член экипажа'}</h1>
      <p className="reveal-goal">
        {impostor
          ? 'Устраняйте экипаж, саботируйте системы и не попадитесь.'
          : `Выполните задания и вычислите ${room.settings.impostorCount > 1 ? 'предателей' : 'предателя'}.`}
      </p>
      <div className="reveal-team">
        {(impostor ? team : room.players.filter((p) => p.id === room.you.id)).map((p) => (
          <div key={p.id} className="reveal-member">
            <Avatar color={p.color} size={64} />
            <span>{p.name}</span>
          </div>
        ))}
      </div>
      <p className="muted">Старт через {seconds ?? 0}…</p>
    </div>
  );
}
