/**
 * Generic TTL cache (L1 in-memory + L2 file) — the cost-control layer for the
 * hybrid keyword stack. Paid sources (DataForSEO) are wrapped in `cached()` so
 * repeated lookups of the same keyword/domain are served for free until the TTL
 * expires. The file layer survives server restarts (unlike a pure memory cache).
 *
 * Cache files live under `data/cache/<namespace>/<hash>.json`.
 */
import { mkdir, readFile, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import TTLCache from '@isaacs/ttlcache';

const mem = new TTLCache<string, unknown>({ max: 5000 });
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');

// Cap how long any value stays in the (volatile) memory tier, even if the
// on-disk TTL is much longer — keeps the working set fresh and bounded.
const MEM_TTL_CAP = 60 * 60 * 1000; // 1h

const keyHash = (parts: unknown[]): string => createHash('sha1')
   .update(JSON.stringify(parts))
   .digest('hex')
   .slice(0, 16);

type CacheEnvelope<T> = { savedAt: number, ttlMs: number, data: T };

/**
 * Returns the cached value when fresh, otherwise runs `producer`, stores the
 * result in both tiers, and returns it. A failed disk read/write is non-fatal —
 * the producer still runs, so the caller always gets data.
 */
export async function cached<T>(opts: {
   namespace: string,
   key: unknown[],
   ttlMs: number,
   producer: () => Promise<T>,
}): Promise<T> {
   const hash = keyHash(opts.key);
   const memId = `${opts.namespace}:${hash}`;

   if (mem.has(memId)) { return mem.get(memId) as T; }

   const dir = path.join(CACHE_DIR, opts.namespace);
   const file = path.join(dir, `${hash}.json`);

   try {
      const raw = await readFile(file, 'utf-8');
      const env = JSON.parse(raw) as CacheEnvelope<T>;
      if (Date.now() - env.savedAt < env.ttlMs) {
         mem.set(memId, env.data, { ttl: Math.min(env.ttlMs, MEM_TTL_CAP) });
         return env.data;
      }
   } catch {
      // cache miss or unreadable — fall through to producer
   }

   const data = await opts.producer();

   try {
      await mkdir(dir, { recursive: true });
      const env: CacheEnvelope<T> = { savedAt: Date.now(), ttlMs: opts.ttlMs, data };
      await writeFile(file, JSON.stringify(env), 'utf-8');
   } catch {
      // best-effort write — ignore disk errors
   }
   mem.set(memId, data, { ttl: Math.min(opts.ttlMs, MEM_TTL_CAP) });
   return data;
}

/** Standard TTLs for the hybrid stack (volume/difficulty barely move month-to-month). */
export const TTL = {
   KEYWORD_METRICS: 30 * 24 * 60 * 60 * 1000, // 30 days — volume/difficulty/cpc
   RANKED_KEYWORDS: 7 * 24 * 60 * 60 * 1000, //  7 days — competitor ranked keywords
   GAP: 7 * 24 * 60 * 60 * 1000, //  7 days — keyword gap
   SERP: 24 * 60 * 60 * 1000, //  1 day  — live SERP snapshots
};
