import { useQuery } from 'react-query';
import { buildServiceStatus, type ReadyFlags, type ServiceStatusView } from '../lib/serviceStatus';

const KEY = 'service-status';

async function fetchJsonSafe(url: string): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  try {
    const res = await fetch(url);
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, body };
  } catch {
    return { ok: false, body: {} };
  }
}

export function useServiceStatus() {
  return useQuery<ServiceStatusView>(
    KEY,
    async () => {
      const [health, ready] = await Promise.all([
        fetchJsonSafe('/api/health'),
        fetchJsonSafe('/api/ready'),
      ]);
      const healthOk = health.ok && health.body.ok === true ? true : health.ok === false ? false : null;
      const readyFlags: ReadyFlags | null = ready.body && ('neon' in ready.body || 'redis' in ready.body || 'sidecar' in ready.body)
        ? {
            neon: typeof ready.body.neon === 'boolean' ? ready.body.neon : null,
            redis: typeof ready.body.redis === 'boolean' ? ready.body.redis : null,
            sidecar: typeof ready.body.sidecar === 'boolean' ? ready.body.sidecar : null,
          }
        : null;
      return buildServiceStatus(healthOk, readyFlags);
    },
    { staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true },
  );
}
