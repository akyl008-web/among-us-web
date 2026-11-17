import { useState } from 'react';
import { MAX_PLAYERS, type RoomSettings, type RoomView } from '@stellar/shared';
import { errorText } from '../../net/errors';
import { useGameSession } from '../../net/useSession';
import { Avatar } from '../components/Avatar';
import { ColorPicker } from '../components/ColorPicker';

const SETTINGS: { key: keyof RoomSettings; label: string; options: number[]; suffix?: string }[] = [
  { key: 'impostorCount', label: 'Предателей', options: [1, 2] },
  {
    key: 'killCooldownSec',
    label: 'Перезарядка убийства',
    options: [15, 20, 25, 30, 45],
    suffix: 'с',
  },
  { key: 'tasksPerPlayer', label: 'Заданий на игрока', options: [2, 3, 4, 5, 6] },
  { key: 'discussionSec', label: 'Обсуждение', options: [0, 15, 30, 45, 60], suffix: 'с' },
  { key: 'votingSec', label: 'Голосование', options: [15, 30, 45, 60, 90], suffix: 'с' },
  { key: 'emergencyMeetings', label: 'Экстренных собраний', options: [0, 1, 2, 3] },
];

export function Lobby({ room }: { room: RoomView }) {
  const session = useGameSession();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === room.you.id;
  const me = room.players.find((p) => p.id === room.you.id);
  const enough =
    room.players.length >= room.minPlayers &&
    room.players.length - room.settings.impostorCount > room.settings.impostorCount;

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked — the code is visible anyway
    }
  };

  return (
    <div className="lobby">
      <header className="lobby-header">
        <div>
          <span className="muted">Код комнаты</span>
          <button
            type="button"
            className="room-code"
            onClick={() => void copyCode()}
            title="Скопировать"
          >
            {room.code}
          </button>
          <span className="muted">{copied ? 'Скопировано!' : 'нажмите, чтобы скопировать'}</span>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => void act(() => session.leaveRoom())}
        >
          Покинуть
        </button>
      </header>

      <div className="lobby-grid">
        <section className="panel">
          <h2 className="panel-title">
            Экипаж {room.players.length}/{MAX_PLAYERS}
          </h2>
          <ul className="player-list">
            {room.players.map((p) => (
              <li key={p.id} className={p.connected ? '' : 'offline'}>
                <Avatar color={p.color} size={34} />
                <span className="player-name">
                  {p.name}
                  {p.id === room.you.id && <span className="muted"> (вы)</span>}
                </span>
                {p.isHost && <span className="tag tag--host">хост</span>}
                {!p.connected && <span className="tag">нет связи</span>}
              </li>
            ))}
          </ul>
          {!enough && (
            <p className="hint">
              Нужно минимум {Math.max(room.minPlayers, room.settings.impostorCount * 2 + 1)}{' '}
              игрока(ов) для старта.
            </p>
          )}
        </section>

        <section className="panel">
          <h2 className="panel-title">Ваш вид</h2>
          {me && (
            <ColorPicker
              value={me.color}
              taken={room.players.map((p) => p.color)}
              onChange={(color) => void act(() => session.updateLobby({ color }))}
            />
          )}
        </section>

        <section className="panel">
          <h2 className="panel-title">
            Настройки {isHost ? '' : <span className="muted">(меняет хост)</span>}
          </h2>
          <div className="settings">
            {SETTINGS.map(({ key, label, options, suffix }) => (
              <label key={key} className="setting">
                <span>{label}</span>
                <select
                  className="input"
                  disabled={!isHost}
                  value={String(room.settings[key])}
                  onChange={(e) =>
                    void act(() => session.updateSettings({ [key]: Number(e.target.value) }))
                  }
                >
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                      {suffix ?? ''}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="setting">
              <span>Показывать роль выброшенного</span>
              <input
                type="checkbox"
                disabled={!isHost}
                checked={room.settings.confirmEjects}
                onChange={(e) =>
                  void act(() => session.updateSettings({ confirmEjects: e.target.checked }))
                }
              />
            </label>
          </div>
          {isHost ? (
            <button
              type="button"
              className="btn btn--primary btn--big"
              disabled={!enough}
              onClick={() => void act(() => session.startGame())}
            >
              Начать игру
            </button>
          ) : (
            <p className="hint">Ожидаем, пока хост начнёт игру…</p>
          )}
          {error && <p className="error">{error}</p>}
        </section>
      </div>
    </div>
  );
}
