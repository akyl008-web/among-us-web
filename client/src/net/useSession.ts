import { createContext, useContext, useSyncExternalStore } from 'react';
import type { GameSession, SessionState } from './GameSession';

export const SessionContext = createContext<GameSession | null>(null);

export function useGameSession(): GameSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useGameSession must be used inside <SessionContext.Provider>');
  return session;
}

/** Subscribes a component to the session store (re-renders on every state change). */
export function useSessionState(): SessionState {
  const session = useGameSession();
  return useSyncExternalStore(session.subscribe, session.getState);
}
