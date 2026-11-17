/** Game-wide limits shared by client and server. Single source of truth. */
export const GAME_TITLE = 'Stellar Suspects';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;
export const MIN_IMPOSTORS = 1;
export const MAX_IMPOSTORS = 2;

export const ROOM_CODE_LENGTH = 6;
/** Excludes ambiguous characters (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const PLAYER_NAME_MIN_LENGTH = 2;
export const PLAYER_NAME_MAX_LENGTH = 16;

/** Server simulation/broadcast rate (ticks per second). */
export const SERVER_TICK_RATE = 20;
