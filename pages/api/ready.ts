import type { NextApiRequest, NextApiResponse } from 'next';
import { queryOne } from '../../lib/db/query';
import { logResolvedSidecarUrl } from '../../lib/serviceUrls';

function redisRequired(): boolean {
  return (
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    process.env.NODE_ENV === 'production'
  );
}

function isRailway(): boolean {
  return Boolean(process.env.RAILWAY_ENVIRONMENT);
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    await queryOne<{ ok: number }>('SELECT 1 AS ok');
  } catch {
    return res.status(503).json({ ok: false, neon: false, redis: null, sidecar: null });
  }

  if (redisRequired()) {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      return res.status(503).json({
        ok: false,
        neon: true,
        redis: false,
        sidecar: null,
        reason: 'REDIS_URL missing',
      });
    }
    try {
      const { default: Redis } = await import('ioredis');
      const client = new Redis(url, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        lazyConnect: true,
      });
      try {
        await client.connect();
        const pong = await client.ping();
        if (pong !== 'PONG') throw new Error('unexpected ping');
      } finally {
        await client.quit().catch(() => client.disconnect());
      }
    } catch {
      return res.status(503).json({ ok: false, neon: true, redis: false, sidecar: null });
    }
  }

  if (isRailway()) {
    const sidecar =
      process.env.PYTHON_SIDECAR_URL?.trim() || process.env.SIDECAR_URL?.trim() || '';
    if (!sidecar) {
      return res.status(503).json({
        ok: false,
        neon: true,
        redis: true,
        sidecar: false,
        reason: 'PYTHON_SIDECAR_URL missing',
      });
    }
    if (/onrender\.com/i.test(sidecar)) {
      return res.status(503).json({
        ok: false,
        neon: true,
        redis: true,
        sidecar: false,
        reason: 'Render sidecar URL refused',
      });
    }
  }

  logResolvedSidecarUrl();
  return res.status(200).json({ ok: true, neon: true, redis: true, sidecar: true });
}
