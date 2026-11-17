import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  ClientToServerEvents,
  HealthResponse,
  JoinedRoom,
  RoomView,
  ServerToClientEvents,
} from '@stellar/shared';
import { createServer, type RunningServer } from './createServer.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: RunningServer;
let baseUrl: string;
const sockets: ClientSocket[] = [];

beforeAll(async () => {
  server = createServer({
    corsOrigins: ['http://localhost:5173'],
    authSecret: 's'.repeat(40),
    minPlayers: 3,
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = server.httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await server.close();
});

function connect(token?: string): Promise<ClientSocket> {
  const socket: ClientSocket = ioClient(baseUrl, {
    transports: ['websocket'],
    forceNew: true,
    ...(token ? { auth: { token } } : {}),
  });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

/** Resolves with the next room:state matching the predicate. */
function nextState(
  socket: ClientSocket,
  predicate: (v: RoomView) => boolean = () => true,
): Promise<RoomView> {
  return new Promise((resolve) => {
    const handler = (view: RoomView) => {
      if (predicate(view)) {
        socket.off('room:state', handler);
        resolve(view);
      }
    };
    socket.on('room:state', handler);
  });
}

async function createRoom(name = 'Host'): Promise<{ socket: ClientSocket; joined: JoinedRoom }> {
  const socket = await connect();
  const res = await socket.emitWithAck('room:create', { name });
  if (!res.ok) throw new Error(res.error);
  return { socket, joined: res.data };
}

async function joinRoom(
  code: string,
  name: string,
): Promise<{ socket: ClientSocket; joined: JoinedRoom }> {
  const socket = await connect();
  const res = await socket.emitWithAck('room:join', { code, name });
  if (!res.ok) throw new Error(res.error);
  return { socket, joined: res.data };
}

describe('HTTP', () => {
  it('GET /api/health returns ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = (await res.json()) as HealthResponse;
    expect(body).toMatchObject({ status: 'ok', persistence: 'memory' });
  });

  it('registers, logs in, and keeps roles out of public profiles', async () => {
    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'astro_test', password: 'supersecret1' }),
    });
    expect(register.status).toBe(201);

    const dup = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'astro_test', password: 'supersecret1' }),
    });
    expect(dup.status).toBe(409);

    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'astro_test', password: 'nope' }),
    });
    expect(badLogin.status).toBe(401);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'astro_test', password: 'supersecret1' }),
    });
    const { token } = (await login.json()) as { token: string };
    const me = await fetch(`${baseUrl}/api/profile/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);

    const pub = await (await fetch(`${baseUrl}/api/profiles/astro_test`)).json();
    expect(pub).toMatchObject({ username: 'astro_test', gamesPlayed: 0 });
    expect(JSON.stringify(pub)).not.toMatch(/role|passwordHash/i);
  });

  it('rejects invalid input and unauthenticated profile access', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'a', password: 'short', isAdmin: true }),
    });
    expect(res.status).toBe(400);
    expect((await fetch(`${baseUrl}/api/profile/me`)).status).toBe(401);
  });
});

describe('Socket.IO rooms', () => {
  it('creates a room and lets others join by code', async () => {
    const host = await createRoom();
    expect(host.joined.code).toMatch(/^[A-Z2-9]{6}$/);
    const guest = await joinRoom(host.joined.code.toLowerCase(), 'Guest');
    const view = await nextState(host.socket, (v) => v.players.length === 2);
    expect(view.players.map((p) => p.name).sort()).toEqual(['Guest', 'Host']);
    expect(view.hostId).toBe(host.joined.playerId);
    guest.socket.disconnect();
  });

  it('rejects unknown codes and malformed payloads', async () => {
    const socket = await connect();
    expect(await socket.emitWithAck('room:join', { code: 'ZZZZZZ', name: 'Bob' })).toMatchObject({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
    // @ts-expect-error forged extra field
    expect(
      await socket.emitWithAck('room:create', { name: 'Bob', role: 'IMPOSTOR' }),
    ).toMatchObject({
      ok: false,
      error: 'VALIDATION_FAILED',
    });
  });

  it('rejects non-host start and reconnects with a valid session token only', async () => {
    const host = await createRoom();
    const guest = await joinRoom(host.joined.code, 'Guest');
    expect(await guest.socket.emitWithAck('game:start')).toMatchObject({
      ok: false,
      error: 'NOT_HOST',
    });

    guest.socket.disconnect();
    const forged = await connect();
    expect(
      await forged.emitWithAck('room:reconnect', {
        code: host.joined.code,
        playerId: guest.joined.playerId,
        sessionToken: 'x'.repeat(32),
      }),
    ).toMatchObject({ ok: false, error: 'UNAUTHORIZED' });

    const again = await connect();
    const res = await again.emitWithAck('room:reconnect', {
      code: host.joined.code,
      playerId: guest.joined.playerId,
      sessionToken: guest.joined.sessionToken,
    });
    expect(res.ok).toBe(true);
  });

  it('starts a game and keeps roles private over the wire', async () => {
    const host = await createRoom();
    const others = [
      await joinRoom(host.joined.code, 'Bob'),
      await joinRoom(host.joined.code, 'Cat'),
      await joinRoom(host.joined.code, 'Dan'),
    ];
    const all = [host, ...others];
    const states = all.map((p) => nextState(p.socket, (v) => v.phase === 'STARTING'));
    expect(await host.socket.emitWithAck('game:start')).toEqual({ ok: true, data: null });
    const views = await Promise.all(states);

    const impostors = views.filter((v) => v.you.role === 'IMPOSTOR');
    const crew = views.filter((v) => v.you.role === 'CREWMATE');
    expect(impostors).toHaveLength(1);
    expect(crew).toHaveLength(3);
    for (const v of crew) {
      expect(v.impostorIds).toEqual([]);
      expect(JSON.stringify(v)).not.toContain('IMPOSTOR');
    }
    expect(impostors[0]!.impostorIds).toEqual([impostors[0]!.you.id]);

    // crewmates cannot kill, even if they forge the event
    const crewSocket = all[views.indexOf(crew[0]!)]!.socket;
    expect(
      await crewSocket.emitWithAck('impostor:kill', { targetId: crew[1]!.you.id }),
    ).toMatchObject({ ok: false });
  });

  it('rate-limits join attempts (room code brute force)', async () => {
    const socket = await connect();
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        socket.emitWithAck('room:join', { code: 'AAAAAA', name: 'Brute' }),
      ),
    );
    expect(results.some((r) => !r.ok && r.error === 'RATE_LIMITED')).toBe(true);
  });

  it('answers system:ping', async () => {
    const socket = await connect();
    const res = await socket.emitWithAck('system:ping', { clientTime: 123 });
    expect(res).toMatchObject({ ok: true, data: { clientTime: 123 } });
  });
});
