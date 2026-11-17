import { useConnection } from '../net/useConnection';
import { useServerHealth } from '../net/useServerHealth';

function Indicator({
  tone,
  label,
  value,
}: {
  tone: 'ok' | 'warn' | 'bad';
  label: string;
  value: string;
}) {
  return (
    <div className="status-row">
      <span className={`dot dot--${tone}`} aria-hidden />
      <span className="status-label">{label}</span>
      <span className="status-value">{value}</span>
    </div>
  );
}

/** Stage 1 diagnostics: proves client ↔ server HTTP and WebSocket links work. */
export function StatusPanel({ fps }: { fps: number | null }) {
  const health = useServerHealth();
  const conn = useConnection();

  return (
    <section className="panel">
      <h2 className="panel-title">Состояние систем</h2>
      <Indicator
        tone={health.status === 'ok' ? 'ok' : health.status === 'loading' ? 'warn' : 'bad'}
        label="HTTP /api/health"
        value={
          health.status === 'ok'
            ? `ok · v${health.data.version}`
            : health.status === 'loading'
              ? 'проверка…'
              : health.message
        }
      />
      <Indicator
        tone={conn.state === 'connected' ? 'ok' : conn.state === 'connecting' ? 'warn' : 'bad'}
        label="Socket.IO"
        value={conn.state === 'connected' ? `connected · ${conn.socketId ?? ''}` : conn.state}
      />
      <Indicator
        tone={conn.latencyMs === null ? 'warn' : conn.latencyMs < 100 ? 'ok' : 'bad'}
        label="Ping"
        value={conn.latencyMs === null ? '—' : `${conn.latencyMs} ms`}
      />
      <Indicator
        tone={fps === null ? 'warn' : 'ok'}
        label="Phaser FPS"
        value={fps === null ? 'загрузка…' : String(fps)}
      />
    </section>
  );
}
