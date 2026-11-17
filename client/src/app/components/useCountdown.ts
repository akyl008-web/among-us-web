import { useEffect, useState } from 'react';

/** Seconds left for a server `remainingMs` value received at `receivedAt` (performance.now()). */
export function useCountdown(
  remainingMs: number | null | undefined,
  receivedAt: number,
): number | null {
  const [now, setNow] = useState(() => performance.now());
  const active = remainingMs !== null && remainingMs !== undefined;

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!active) return null;
  const elapsed = Math.max(0, now - receivedAt);
  return Math.max(0, Math.ceil((remainingMs - elapsed) / 1000));
}
