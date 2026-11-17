import type { RoomView } from '@stellar/shared';
import { Avatar } from '../components/Avatar';

export function ResultOverlay({ room }: { room: RoomView }) {
  const result = room.result!;
  const ejected = room.players.find((p) => p.id === result.ejectedId);
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? '?';

  let headline = 'Никого не выбросили.';
  if (ejected) {
    headline =
      result.ejectedWasImpostor === null
        ? `${ejected.name} был выброшен в космос.`
        : `${ejected.name} ${result.ejectedWasImpostor ? 'был предателем.' : 'не был предателем.'}`;
  } else if (result.tie) headline = 'Ничья — никого не выбросили.';

  return (
    <div className="overlay result">
      {ejected && (
        <div className="ejected">
          <Avatar color={ejected.color} size={90} dead />
        </div>
      )}
      <h1>{headline}</h1>
      <div className="vote-breakdown">
        {Object.entries(result.votes).map(([target, voters]) => (
          <p key={target}>
            <strong>{nameOf(target)}</strong>: {voters.map(nameOf).join(', ')}
          </p>
        ))}
        {result.skipVoterIds.length > 0 && (
          <p>
            <strong>Пропуск</strong>: {result.skipVoterIds.map(nameOf).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
