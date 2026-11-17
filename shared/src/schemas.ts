import { z } from 'zod';
import {
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_MIN_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from './constants.js';
import { PLAYER_COLORS } from './game.js';

/**
 * Zod schemas for every client → server payload.
 * The server MUST parse incoming data with these before using it.
 */
export const pingPayloadSchema = z.strictObject({
  clientTime: z.number().int().nonnegative(),
});
export type PingPayload = z.infer<typeof pingPayloadSchema>;

export const playerNameSchema = z
  .string()
  .trim()
  .min(PLAYER_NAME_MIN_LENGTH)
  .max(PLAYER_NAME_MAX_LENGTH)
  .regex(/^[\p{L}\p{N} _-]+$/u, 'Only letters, digits, space, _ and -');

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .refine((code) => [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch)), 'Invalid room code');

export const playerColorSchema = z.enum(PLAYER_COLORS);
