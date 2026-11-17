import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ClientToServerEvents, HealthResponse, ServerToClientEvents } from '@stellar/shared';
import { createServer, type RunningServer } from './createServer.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: RunningServer;
let baseUrl: string;

beforeAll(async () => {
  server = createServer({ CLIENT_ORIGIN: ['http://localhost:5173'] });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = server.httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await server.close();
});

function connect(): Promise<ClientSocket> {
  const socket: ClientSocket = ioClient(baseUrl, { transports: ['websocket'], forceNew: true });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

describe('HTTP', () => {
  it('GET /api/health returns ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthResponse;
    expect(body.status).toBe('ok');
  });

  it('unknown /api route returns 404 JSON', async () => {
    const res = await fetch(`${baseUrl}/api/nope`);
    expect(res.status).toBe(404);
  });
});

describe('Socket.IO', () => {
  it('sends system:hello on connect', async () => {
    const socket: ClientSocket = ioClient(baseUrl, { transports: ['websocket'], forceNew: true });
    const hello = await new Promise<{ socketId: string }>((resolve) =>
      socket.once('system:hello', resolve),
    );
    expect(hello.socketId).toBe(socket.id);
    socket.disconnect();
  });

  it('answers a valid ping', async () => {
    const socket = await connect();
    const res = await socket.emitWithAck('system:ping', { clientTime: 123 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.clientTime).toBe(123);
    socket.disconnect();
  });

  it('rejects an invalid ping payload', async () => {
    const socket = await connect();
    // @ts-expect-error — intentionally sending a malformed payload
    const res = await socket.emitWithAck('system:ping', { clientTime: 'bad' });
    expect(res).toEqual({ ok: false, error: 'VALIDATION_FAILED' });
    socket.disconnect();
  });

  it('rate-limits event spam', async () => {
    const socket = await connect();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => socket.emitWithAck('system:ping', { clientTime: 1 })),
    );
    expect(results.some((r) => !r.ok && r.error === 'RATE_LIMITED')).toBe(true);
    socket.disconnect();
  });
});
