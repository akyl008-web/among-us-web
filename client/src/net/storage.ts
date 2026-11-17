import type { JoinedRoom } from '@stellar/shared';

/**
 * Browser storage helpers. Every access is wrapped in try/catch: storage can be
 * unavailable (private mode, blocked cookies) and the game must still work.
 */
const ROOM_KEY = 'stellar.room';
const TOKEN_KEY = 'stellar.authToken';
const PREFS_KEY = 'stellar.prefs';

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // ignore
  }
}

/** Room credentials live in sessionStorage: survive a reload, not a new tab. */
export const roomStorage = {
  load(): JoinedRoom | null {
    const raw = read(() => sessionStorage, ROOM_KEY);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as Partial<JoinedRoom>;
      return value.code && value.playerId && value.sessionToken ? (value as JoinedRoom) : null;
    } catch {
      return null;
    }
  },
  save: (joined: JoinedRoom | null) =>
    write(() => sessionStorage, ROOM_KEY, joined ? JSON.stringify(joined) : null),
};

export const tokenStorage = {
  load: () => read(() => localStorage, TOKEN_KEY),
  save: (token: string | null) => write(() => localStorage, TOKEN_KEY, token),
};

export interface Prefs {
  name: string;
  color: string;
}

export const prefsStorage = {
  load(): Partial<Prefs> {
    try {
      return JSON.parse(read(() => localStorage, PREFS_KEY) ?? '{}') as Partial<Prefs>;
    } catch {
      return {};
    }
  },
  save: (prefs: Prefs) => write(() => localStorage, PREFS_KEY, JSON.stringify(prefs)),
};
