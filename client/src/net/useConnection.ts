import { useEffect, useState } from 'react';
import { getSocket } from './socket';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface ConnectionInfo {
  state: ConnectionState;
  socketId: string | null;
  serverVersion: string | null;
  latencyMs: number | null;
}

const PING_INTERVAL_MS = 2000;

/** React hook: connects the shared socket and measures round-trip latency. */
export function useConnection(): ConnectionInfo {
  const [info, setInfo] = useState<ConnectionInfo>({
    state: 'connecting',
    socketId: null,
    serverVersion: null,
    latencyMs: null,
  });

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () =>
      setInfo((s) => ({ ...s, state: 'connected', socketId: socket.id ?? null }));
    const onDisconnect = () => setInfo((s) => ({ ...s, state: 'disconnected', latencyMs: null }));
    const onHello = ({ serverVersion }: { serverVersion: string }) =>
      setInfo((s) => ({ ...s, serverVersion }));

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onDisconnect);
    socket.on('system:hello', onHello);
    socket.connect();

    const timer = window.setInterval(async () => {
      if (!socket.connected) return;
      const sentAt = Date.now();
      try {
        const res = await socket.timeout(3000).emitWithAck('system:ping', { clientTime: sentAt });
        if (res.ok) setInfo((s) => ({ ...s, latencyMs: Date.now() - res.data.clientTime }));
      } catch {
        setInfo((s) => ({ ...s, latencyMs: null }));
      }
    }, PING_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onDisconnect);
      socket.off('system:hello', onHello);
      socket.disconnect();
    };
  }, []);

  return info;
}
