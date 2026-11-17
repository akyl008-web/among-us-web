import { z } from 'zod';
import {
  CHAT_MESSAGE_MAX_LENGTH,
  MAX_IMPOSTORS,
  MIN_IMPOSTORS,
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_MIN_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from './constants.js';
import { PLAYER_COLORS } from './game.js';
import { SabotageType } from './protocol.js';

/**
 * Zod schemas for every client → server payload.
 * The server MUST parse incoming data with these before using it.
 * `strictObject` rejects unknown keys (e.g. a forged `role` or `position`).
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

const entityIdSchema = z.string().min(1).max(64);

export const createRoomSchema = z.strictObject({
  name: playerNameSchema,
  color: playerColorSchema.optional(),
});
export type CreateRoomPayload = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z.strictObject({
  code: roomCodeSchema,
  name: playerNameSchema,
  color: playerColorSchema.optional(),
});
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;

export const reconnectSchema = z.strictObject({
  code: roomCodeSchema,
  playerId: entityIdSchema,
  sessionToken: z.string().min(16).max(128),
});
export type ReconnectPayload = z.infer<typeof reconnectSchema>;

export const lobbyUpdateSchema = z
  .strictObject({
    name: playerNameSchema.optional(),
    color: playerColorSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.color !== undefined, 'Nothing to update');
export type LobbyUpdatePayload = z.infer<typeof lobbyUpdateSchema>;

export const roomSettingsSchema = z.strictObject({
  impostorCount: z.number().int().min(MIN_IMPOSTORS).max(MAX_IMPOSTORS),
  killCooldownSec: z.number().int().min(10).max(60),
  tasksPerPlayer: z.number().int().min(1).max(8),
  discussionSec: z.number().int().min(0).max(120),
  votingSec: z.number().int().min(15).max(180),
  emergencyMeetings: z.number().int().min(0).max(5),
  confirmEjects: z.boolean(),
});
export const roomSettingsPatchSchema = roomSettingsSchema.partial();
export type RoomSettingsPatch = z.infer<typeof roomSettingsPatchSchema>;

export const playerInputSchema = z.strictObject({
  seq: z.number().int().nonnegative(),
  up: z.boolean(),
  down: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
});
export type PlayerInputPayload = z.infer<typeof playerInputSchema>;

export const taskActionSchema = z.strictObject({ taskId: entityIdSchema });
export const killSchema = z.strictObject({ targetId: entityIdSchema });
export const reportSchema = z.strictObject({ bodyId: entityIdSchema });
export const voteSchema = z.strictObject({ targetId: entityIdSchema.nullable() });
export const chatSchema = z.strictObject({
  text: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
});
export const sabotageTriggerSchema = z.strictObject({ type: z.enum(SabotageType) });
export const sabotageFixSchema = z.strictObject({ stationId: entityIdSchema });

/** REST: auth */
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_]+$/, 'Latin letters, digits and _ only');
export const passwordSchema = z.string().min(8).max(128);
export const registerSchema = z.strictObject({
  username: usernameSchema,
  password: passwordSchema,
  displayName: playerNameSchema.optional(),
});
export const loginSchema = z.strictObject({
  username: usernameSchema,
  password: z.string().min(1).max(128),
});
