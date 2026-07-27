export type ServiceLevel = 'ok' | 'degraded' | 'down';

export type ReadyFlags = {
  neon?: boolean | null;
  redis?: boolean | null;
  sidecar?: boolean | null;
};

export type ServiceRow = {
  id: string;
  name: string;
  level: ServiceLevel;
  label: string;
  msg: string;
};

export type ServiceStatusView = {
  overall: ServiceLevel;
  title: string;
  services: ServiceRow[];
};

const LABEL: Record<ServiceLevel, string> = {
  ok: 'Running',
  degraded: 'Delayed',
  down: 'Unavailable',
};

const MSG: Record<ServiceLevel, string> = {
  ok: 'Working normally.',
  degraded: 'May be slower than usual.',
  down: 'Temporarily unavailable — we are looking into it.',
};

const TITLE: Record<ServiceLevel, string> = {
  ok: 'All systems operational',
  degraded: 'Partial disruption',
  down: 'Service disruption',
};

function worst(a: ServiceLevel, b: ServiceLevel): ServiceLevel {
  const rank = { ok: 0, degraded: 1, down: 2 } as const;
  return rank[b] > rank[a] ? b : a;
}

/** Map health + ready flags → user-facing rows (no infra jargon). */
export function buildServiceStatus(
  healthOk: boolean | null,
  ready: ReadyFlags | null,
): ServiceStatusView {
  const services: ServiceRow[] = [];

  const push = (id: string, name: string, level: ServiceLevel) => {
    services.push({ id, name, level, label: LABEL[level], msg: MSG[level] });
  };

  if (healthOk === null) push('app', 'Web app', 'degraded');
  else push('app', 'Web app', healthOk ? 'ok' : 'down');

  if (!ready) {
    // App answered but readiness unknown → treat deps as delayed, not dead.
    push('data', 'Data platform', 'degraded');
    push('jobs', 'Background jobs', 'degraded');
    push('ai', 'AI analysis', 'degraded');
  } else {
    if (ready.neon == null) { /* skip when not reported */ }
    else push('data', 'Data platform', ready.neon ? 'ok' : 'down');

    if (ready.redis == null) { /* optional in non-prod */ }
    else push('jobs', 'Background jobs', ready.redis ? 'ok' : 'degraded');

    if (ready.sidecar == null) { /* optional off Railway */ }
    else push('ai', 'AI analysis', ready.sidecar ? 'ok' : 'degraded');
  }

  const overall = services.reduce<ServiceLevel>((acc, s) => worst(acc, s.level), 'ok');
  return { overall, title: TITLE[overall], services };
}

export function levelCss(level: ServiceLevel): 'green' | 'yellow' | 'red' {
  if (level === 'ok') return 'green';
  if (level === 'degraded') return 'yellow';
  return 'red';
}
