import { useEffect, useState } from 'react';
import type { HealthResponse } from '@stellar/shared';
import { SERVER_URL } from '../config/env';

export type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; data: HealthResponse }
  | { status: 'error'; message: string };

export function useServerHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${SERVER_URL}/api/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setState({ status: 'ok', data: (await res.json()) as HealthResponse });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => controller.abort();
  }, []);

  return state;
}
