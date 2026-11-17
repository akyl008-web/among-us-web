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
export const CHAT_MESSAGE_MAX_LENGTH = 140;

/** Server simulation/broadcast rate (ticks per second). */
export const SERVER_TICK_RATE = 20;

/** Interaction distances in world pixels (validated on the server). */
export const INTERACT_RANGE = 80;
export const KILL_RANGE = 90;
export const REPORT_RANGE = 120;

/** Timings (ms). */
export const STARTING_COUNTDOWN_MS = 4_000;
export const RESULT_DURATION_MS = 6_000;
export const INITIAL_KILL_COOLDOWN_MS = 10_000;
export const SABOTAGE_COOLDOWN_MS = 30_000;
export const REACTOR_MELTDOWN_MS = 40_000;
export const LOBBY_DISCONNECT_GRACE_MS = 15_000;
export const GAME_DISCONNECT_GRACE_MS = 45_000;

/** Minimal time a task must take, per type (anti-cheat: instant completion is rejected). */
export const TASK_MIN_DURATION_MS = {
  WIRES: 1_500,
  HOLD: 2_500,
  SEQUENCE: 1_500,
} as const;

/** Vision radius (px) for crewmates while lights are sabotaged. */
export const LIGHTS_OUT_VISION = 150;
