import {
  createRoomSchema,
  joinRoomSchema,
  lobbyUpdateSchema,
  reconnectSchema,
  roomSettingsPatchSchema,
} from '@stellar/shared';
import type { RoomManager } from '../../game/RoomManager.js';
import { parse, type createResponder } from '../handlerKit.js';
import type { GameSocket } from '../types.js';

type Respond = ReturnType<typeof createResponder>;

/** Room lifecycle: create / join / reconnect / leave / lobby settings / start. */
export function registerRoomHandlers(
  socket: GameSocket,
  rooms: RoomManager,
  respond: Respond,
  respondJoin: Respond,
): void {
  const userId = () => socket.data.userId;

  socket.on('room:create', (payload, ack) =>
    respondJoin('room:create', ack, () =>
      rooms.createRoom(socket.id, parse(createRoomSchema, payload), userId()),
    ),
  );

  // Separate, strict limiter for joins: makes brute-forcing room codes impractical.
  socket.on('room:join', (payload, ack) =>
    respondJoin('room:join', ack, () =>
      rooms.joinRoom(socket.id, parse(joinRoomSchema, payload), userId()),
    ),
  );

  socket.on('room:reconnect', (payload, ack) =>
    respondJoin('room:reconnect', ack, () =>
      rooms.reconnect(socket.id, parse(reconnectSchema, payload)),
    ),
  );

  socket.on('room:leave', (ack) => respond('room:leave', ack, () => rooms.leave(socket.id)));

  socket.on('lobby:update', (payload, ack) =>
    respond('lobby:update', ack, () => {
      const { room, playerId } = rooms.context(socket.id);
      room.updateLobby(playerId, parse(lobbyUpdateSchema, payload));
    }),
  );

  socket.on('lobby:settings', (payload, ack) =>
    respond('lobby:settings', ack, () => {
      const { room, playerId } = rooms.context(socket.id);
      room.updateSettings(playerId, parse(roomSettingsPatchSchema, payload));
    }),
  );

  socket.on('game:start', (ack) =>
    respond('game:start', ack, () => {
      const { room, playerId } = rooms.context(socket.id);
      room.start(playerId);
    }),
  );

  socket.on('game:returnToLobby', (ack) =>
    respond('game:returnToLobby', ack, () => {
      const { room, playerId } = rooms.context(socket.id);
      room.returnToLobby(playerId);
    }),
  );
}
