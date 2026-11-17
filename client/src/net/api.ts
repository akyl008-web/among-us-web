import type { PlayerColor, Role } from '@stellar/shared';
import { SERVER_URL } from '../config/env';
import { tokenStorage } from './storage';

export interface PublicProfile {
  username: string;
  displayName: string;
  preferredColor: PlayerColor;
  gamesPlayed: number;
  gamesWon: number;
  tasksCompleted: number;
  memberSince: string;
}

export interface OwnMatch {
  matchId: string;
  endedAt: string;
  role: Role;
  won: boolean;
  survived: boolean;
  tasksCompleted: number;
  kills: number;
}

const ERRORS: Record<string, string> = {
  USERNAME_TAKEN: 'Имя пользователя занято',
  INVALID_CREDENTIALS: 'Неверный логин или пароль',
  VALIDATION_FAILED: 'Проверьте поля: логин 3–24 символа (a-z, 0-9, _), пароль от 8 символов',
  RATE_LIMITED: 'Слишком много попыток, подождите',
  UNAUTHORIZED: 'Войдите снова',
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStorage.load();
  const res = await fetch(`${SERVER_URL}/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(ERRORS[body.error ?? ''] ?? `Ошибка ${res.status}`);
  return body;
}

export const api = {
  register: (username: string, password: string) =>
    call<{ token: string; user: { id: string; username: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    call<{ token: string; user: { id: string; username: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => call<{ profile: PublicProfile; matches: OwnMatch[] }>('/profile/me'),
  leaderboard: () => call<PublicProfile[]>('/leaderboard'),
};
