type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, message: string, meta?: Record<string, unknown>): void {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta) out(line, meta);
  else out(line);
}

/** Minimal logger facade — can be swapped for pino later without touching callers. */
export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
};
