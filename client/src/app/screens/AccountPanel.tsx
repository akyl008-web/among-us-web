import { useEffect, useState, type FormEvent } from 'react';
import { api, type OwnMatch, type PublicProfile } from '../../net/api';
import { tokenStorage } from '../../net/storage';
import { useGameSession, useSessionState } from '../../net/useSession';

/** Optional account: register/login to keep statistics. Guests can play without it. */
export function AccountPanel() {
  const session = useGameSession();
  const { userId } = useSessionState();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<{ profile: PublicProfile; matches: OwnMatch[] } | null>(
    null,
  );

  useEffect(() => {
    if (!userId) return;
    api
      .me()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [userId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === 'login'
          ? await api.login(username, password)
          : await api.register(username, password);
      tokenStorage.save(res.token);
      setPassword('');
      session.reconnectSocket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    tokenStorage.save(null);
    session.reconnectSocket();
  };

  const visible = userId ? profile : null;
  if (visible) {
    const p = visible.profile;
    return (
      <section className="panel account">
        <h2 className="panel-title">Профиль</h2>
        <p className="account-name">{p.displayName}</p>
        <div className="stats">
          <div>
            <strong>{p.gamesPlayed}</strong>
            <span>игр</span>
          </div>
          <div>
            <strong>{p.gamesWon}</strong>
            <span>побед</span>
          </div>
          <div>
            <strong>{p.tasksCompleted}</strong>
            <span>заданий</span>
          </div>
        </div>
        {visible.matches.length > 0 && (
          <ul className="history">
            {visible.matches.slice(0, 5).map((m) => (
              <li key={m.matchId} className={m.won ? 'win' : 'loss'}>
                {m.won ? 'Победа' : 'Поражение'} · {m.role === 'IMPOSTOR' ? 'предатель' : 'экипаж'}
                {m.kills > 0 ? ` · устранений: ${m.kills}` : ''}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn--ghost" onClick={logout}>
          Выйти
        </button>
      </section>
    );
  }

  return (
    <section className="panel account">
      <h2 className="panel-title">
        Аккаунт <span className="muted">(необязательно)</span>
      </h2>
      <div className="tabs">
        <button
          type="button"
          className={mode === 'login' ? 'tab tab--active' : 'tab'}
          onClick={() => setMode('login')}
        >
          Вход
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'tab tab--active' : 'tab'}
          onClick={() => setMode('register')}
        >
          Регистрация
        </button>
      </div>
      <form onSubmit={submit} className="form">
        <input
          className="input"
          placeholder="Логин"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Пароль (от 8 символов)"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn" disabled={busy || !username || !password}>
          {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>
      </form>
      <p className="hint">Статистика побед сохраняется только для вошедших игроков.</p>
    </section>
  );
}
