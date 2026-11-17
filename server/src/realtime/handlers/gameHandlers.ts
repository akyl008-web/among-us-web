import {
  chatSchema,
  killSchema,
  playerInputSchema,
  reportSchema,
  sabotageFixSchema,
  sabotageTriggerSchema,
  taskActionSchema,
  voteSchema,
} from '@stellar/shared';
import type { RoomManager } from '../../game/RoomManager.js';
import { parse, type createResponder } from '../handlerKit.js';
import type { RateLimiter } from '../rateLimiter.js';
import type { GameSocket } from '../types.js';

type Respond = ReturnType<typeof createResponder>;

/**
 * In-game intents. The client only says WHAT it wants to do;
 * GameRoom decides IF it is allowed (role, alive, phase, distance, cooldown).
 */
export function registerGameHandlers(
  socket: GameSocket,
  rooms: RoomManager,
  respond: Respond,
  respondChat: Respond,
  inputLimiter: RateLimiter,
): void {
  const ctx = () => rooms.context(socket.id);

  socket.on('player:input', (payload) => {
    if (!inputLimiter.tryConsume(socket.id)) return;
    const parsed = playerInputSchema.safeParse(payload);
    if (!parsed.success) return;
    try {
      const { room, playerId } = ctx();
      room.handleInput(playerId, parsed.data);
    } catch {
      // not in a room — ignore silently (high-frequency event, no ack)
    }
  });

  socket.on('task:start', (payload, ack) =>
    respond('task:start', ack, () => {
      const { room, playerId } = ctx();
      room.startTask(playerId, parse(taskActionSchema, payload).taskId);
    }),
  );

  socket.on('task:cancel', (ack) =>
    respond('task:cancel', ack, () => {
      const { room, playerId } = ctx();
      room.cancelTask(playerId);
    }),
  );

  socket.on('task:complete', (payload, ack) =>
    respond('task:complete', ack, () => {
      const { room, playerId } = ctx();
      room.completeTask(playerId, parse(taskActionSchema, payload).taskId);
    }),
  );

  socket.on('impostor:kill', (payload, ack) =>
    respond('impostor:kill', ack, () => {
      const { room, playerId } = ctx();
      room.kill(playerId, parse(killSchema, payload).targetId);
    }),
  );

  socket.on('body:report', (payload, ack) =>
    respond('body:report', ack, () => {
      const { room, playerId } = ctx();
      room.reportBody(playerId, parse(reportSchema, payload).bodyId);
    }),
  );

  socket.on('meeting:call', (ack) =>
    respond('meeting:call', ack, () => {
      const { room, playerId } = ctx();
      room.callEmergency(playerId);
    }),
  );

  socket.on('meeting:vote', (payload, ack) =>
    respond('meeting:vote', ack, () => {
      const { room, playerId } = ctx();
      room.vote(playerId, parse(voteSchema, payload).targetId);
    }),
  );

  socket.on('meeting:chat', (payload, ack) =>
    respondChat('meeting:chat', ack, () => {
      const { room, playerId } = ctx();
      room.chat(playerId, parse(chatSchema, payload).text);
    }),
  );

  socket.on('sabotage:trigger', (payload, ack) =>
    respond('sabotage:trigger', ack, () => {
      const { room, playerId } = ctx();
      room.triggerSabotage(playerId, parse(sabotageTriggerSchema, payload).type);
    }),
  );

  socket.on('sabotage:fix', (payload, ack) =>
    respond('sabotage:fix', ack, () => {
      const { room, playerId } = ctx();
      room.fixSabotage(playerId, parse(sabotageFixSchema, payload).stationId);
    }),
  );
}
