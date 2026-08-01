import type { NextApiRequest, NextApiResponse } from 'next';
import { assertCronSecret } from '../../../lib/cronAuth';
import { getCurrentUserId } from '../../../utils/getUser';
import { getCallerRole } from '../../../lib/members';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { queryOne } from '../../../lib/db/query';
import { isStripeConfigured } from '../../../lib/stripe';
import { sidecarUrl, isLocalServiceUrl } from '../../../lib/serviceUrls';
import { isSentryEnabled } from '../../../lib/sentryEnv';

type CheckStatus = 'ok' | 'fail' | 'skip' | 'unknown';

type Check = { id: string; status: CheckStatus; detail?: string };

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronOk = assertCronSecret(req);
  if (!cronOk) {
    const userId = await getCurrentUserId(req, res);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const role = await getCallerRole(String(userId)).catch(() => null);
    if (role !== 'owner') return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const checks: Check[] = [];
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);

  // Neon
  try {
    await queryOne<{ ok: number }>('SELECT 1 AS ok');
    checks.push({ id: 'neon', status: 'ok' });
  } catch (e) {
    checks.push({ id: 'neon', status: 'fail', detail: e instanceof Error ? e.message : 'query failed' });
  }

  // Redis
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    checks.push({ id: 'redis', status: isProd ? 'fail' : 'skip', detail: 'REDIS_URL missing' });
  } else {
    try {
      const { default: Redis } = await import('ioredis');
      const client = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 3000, lazyConnect: true });
      try {
        await client.connect();
        const pong = await client.ping();
        checks.push({ id: 'redis', status: pong === 'PONG' ? 'ok' : 'fail', detail: String(pong) });
      } finally {
        await client.quit().catch(() => client.disconnect());
      }
    } catch (e) {
      checks.push({ id: 'redis', status: 'fail', detail: e instanceof Error ? e.message : 'ping failed' });
    }
  }

  // Sidecar
  const side = sidecarUrl();
  if (!side || (isProd && isLocalServiceUrl(side))) {
    checks.push({ id: 'sidecar', status: isProd ? 'fail' : 'skip', detail: 'PYTHON_SIDECAR_URL missing or local in prod' });
  } else {
    try {
      const r = await fetch(`${side.replace(/\/$/, '')}/ready`, { signal: AbortSignal.timeout?.(5000) });
      checks.push({ id: 'sidecar', status: r.ok ? 'ok' : 'fail', detail: `HTTP ${r.status}` });
    } catch (e) {
      checks.push({ id: 'sidecar', status: 'fail', detail: e instanceof Error ? e.message : 'unreachable' });
    }
  }

  checks.push({
    id: 'stripe',
    status: isStripeConfigured() ? 'ok' : (isProd ? 'fail' : 'skip'),
    detail: isStripeConfigured() ? undefined : 'Stripe keys missing',
  });

  const resend = Boolean((process.env.RESEND_API_KEY || process.env.RESEND_APIKEY || '').trim());
  checks.push({ id: 'resend', status: resend ? 'ok' : (isProd ? 'fail' : 'skip') });

  const posthog = Boolean((process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || process.env.POSTHOG_API_KEY || '').trim());
  checks.push({ id: 'posthog', status: posthog ? 'ok' : 'skip' });

  checks.push({ id: 'sentry', status: isSentryEnabled() ? 'ok' : 'skip' });

  const storage = Boolean((process.env.AWS_ACCESS_KEY_ID || process.env.S3_BUCKET || '').trim());
  checks.push({ id: 'storage', status: storage ? 'ok' : 'skip' });

  checks.push({
    id: 'workers',
    status: process.env.PIPELINE_INLINE_WORKERS === '1' ? 'ok' : 'unknown',
    detail: 'Separate pipeline-workers process expected when PIPELINE_INLINE_WORKERS=0',
  });

  const scored = checks.filter((c) => c.status === 'ok' || c.status === 'fail');
  const okCount = scored.filter((c) => c.status === 'ok').length;
  const score = scored.length ? Math.round((okCount / scored.length) * 100) : 0;

  const criticalIds = ['neon', 'redis', 'sidecar'] as const;
  const ready = criticalIds.every((id) => {
    const c = checks.find((x) => x.id === id);
    if (!c) return false;
    if (!isProd && (c.status === 'skip' || c.status === 'unknown')) return true;
    return c.status === 'ok';
  });

  return res.status(200).json({ ok: true, ready, score, checks });
}

export default withOrgPaymentAccess(handler);
