import { useState, type FormEvent } from 'react';
import {
  GAME_TITLE,
  MAX_PLAYERS,
  playerColorSchema,
  playerNameSchema,
  roomCodeSchema,
  type PlayerColor,
} from '@stellar/shared';
import { errorText } from '../../net/errors';
import { prefsStorage } from '../../net/storage';
import { useGameSession, useSessionState } from '../../net/useSession';
import { Avatar } from '../components/Avatar';
import { ColorPicker } from '../components/ColorPicker';
import { AccountPanel } from './AccountPanel';

export function MainMenu() {
  const session = useGameSession();
  const { connection } = useSessionState();
  const saved = prefsStorage.load();
  const [name, setName] = useState(saved.name ?? '');
  const [color, setColor] = useState<PlayerColor>(
    playerColorSchema.safeParse(saved.color).data ?? 'cyan',
  );
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameCheck = playerNameSchema.safeParse(name);
  const codeCheck = roomCodeSchema.safeParse(code);
  const online = connection === 'connected';

  const run = async (action: () => Promise<void>) => {
    if (!nameCheck.success) {
      setError('Имя: 2–16 символов, буквы, цифры, пробел, _ и -');
      return;
    }
    setBusy(true);
    setError(null);
    prefsStorage.save({ name: nameCheck.data, color });
    try {
      await action();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (!codeCheck.success) {
      setError('Код комнаты — 6 символов');
      return;
    }
    void run(() => session.joinRoom(codeCheck.data, nameCheck.data ?? name, color));
  };

  return (
    <div className="menu">
      <header className="menu-hero">
        <Avatar color={color} size={84} />
        <div>
          <h1 className="logo">{GAME_TITLE}</h1>
          <p className="tagline">
            Экипаж чинит корабль. Среди вас — предатели. Найдите их до того, как станет поздно.
          </p>
        </div>
      </header>

      <div className="menu-grid">
        <section className="panel">
          <h2 className="panel-title">Ваш персонаж</h2>
          <label className="field">
            <span>Имя</span>
            <input
              className="input"
              maxLength={16}
              placeholder="Например, Akyl"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={name.length > 0 && !nameCheck.success}
            />
          </label>
          <span className="field-label">Цвет</span>
          <ColorPicker value={color} onChange={setColor} />
        </section>

        <section className="panel">
          <h2 className="panel-title">Играть</h2>
          <button
            type="button"
            className="btn btn--primary btn--big"
            disabled={busy || !online}
            onClick={() => void run(() => session.createRoom(nameCheck.data ?? name, color))}
          >
            Создать комнату
          </button>
          <div className="divider">
            <span>или</span>
          </div>
          <form className="join-form" onSubmit={join}>
            <input
              className="input input--code"
              placeholder="КОД"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              aria-label="Код комнаты"
            />
            <button type="submit" className="btn" disabled={busy || !online || !codeCheck.success}>
              Войти
            </button>
          </form>
          {error && <p className="error">{error}</p>}
          <p className="hint">
            {online
              ? `До ${MAX_PLAYERS} игроков в комнате. Поделитесь кодом с друзьями.`
              : 'Подключение к серверу…'}
          </p>
        </section>

        <AccountPanel />
      </div>
    </div>
  );
}
