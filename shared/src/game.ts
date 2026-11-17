/**
 * Core domain enums. Defined as const objects (not TS enums) so they work
 * with `verbatimModuleSyntax` and serialize as plain strings over the wire.
 */
export const GamePhase = {
  WAITING: 'WAITING',
  STARTING: 'STARTING',
  PLAYING: 'PLAYING',
  MEETING: 'MEETING',
  RESULT: 'RESULT',
  FINISHED: 'FINISHED',
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

export const Role = {
  CREWMATE: 'CREWMATE',
  IMPOSTOR: 'IMPOSTOR',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const PLAYER_COLORS = [
  'red',
  'blue',
  'green',
  'pink',
  'orange',
  'yellow',
  'black',
  'white',
  'purple',
  'cyan',
] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];
