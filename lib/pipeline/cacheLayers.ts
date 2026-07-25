/**
 * L1 memory → L2 Redis → L3 Postgres → L4 fresh (miss).
 * Thin cache for Corpus / Feature Store reads.
 */
import { createHash } from 'crypto';

type CacheEntry = { value: unknown; expiresAt: number };

const l1 = new Map<string, CacheEntry>();
const L1_MAX = 500;

function cacheKey(ns: string, parts: string[]): string {
  return createHash('sha256').update([ns, ...parts].join('|')).digest('hex').slice(0, 24);
}

function l1Get<T>(key: string): T | undefined {
  const e = l1.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    l1.delete(key);
    return undefined;
  }
  return e.value as T;
}

function l1Set(key: string, value: unknown, ttlMs: number): void {
  if (l1.size >= L1_MAX) {
    const first = l1.keys().next().value;
    if (first) l1.delete(first);
  }
  l1.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function redisGet(key: string): Promise<string | null> {
  const url = process.env.REDIS_URL || '';
  if (!url) return null;
  try {
    const { default: Redis } = await import('ioredis');
    const r = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    await r.connect();
    const v = await r.get(`ranksmile:cache:${key}`);
    await r.quit();
    return v;
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: string, ttlSec: number): Promise<void> {
  const url = process.env.REDIS_URL || '';
  if (!url) return;
  try {
    const { default: Redis } = await import('ioredis');
    const r = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    await r.connect();
    await r.setex(`ranksmile:cache:${key}`, ttlSec, value);
    await r.quit();
  } catch {
    /* ignore */
  }
}

export type CacheReadResult<T> = {
  value: T | null;
  layer: 'L1' | 'L2' | 'L3' | 'L4';
};

/**
 * Read-through cache. `loadL3` = Postgres loader; on miss returns L4 (caller fetches fresh).
 */
export async function cacheGetOrLoad<T>(opts: {
  namespace: string;
  parts: string[];
  ttlMs?: number;
  loadL3: () => Promise<T | null>;
}): Promise<CacheReadResult<T>> {
  const key = cacheKey(opts.namespace, opts.parts);
  const ttlMs = opts.ttlMs ?? 60_000;

  const mem = l1Get<T>(key);
  if (mem !== undefined) return { value: mem, layer: 'L1' };

  const redisRaw = await redisGet(key);
  if (redisRaw) {
    try {
      const parsed = JSON.parse(redisRaw) as T;
      l1Set(key, parsed, ttlMs);
      return { value: parsed, layer: 'L2' };
    } catch {
      /* fall through */
    }
  }

  const fromDb = await opts.loadL3();
  if (fromDb != null) {
    l1Set(key, fromDb, ttlMs);
    void redisSet(key, JSON.stringify(fromDb), Math.ceil(ttlMs / 1000));
    return { value: fromDb, layer: 'L3' };
  }

  return { value: null, layer: 'L4' };
}

export async function cachePut(opts: {
  namespace: string;
  parts: string[];
  value: unknown;
  ttlMs?: number;
}): Promise<void> {
  const key = cacheKey(opts.namespace, opts.parts);
  const ttlMs = opts.ttlMs ?? 60_000;
  l1Set(key, opts.value, ttlMs);
  void redisSet(key, JSON.stringify(opts.value), Math.ceil(ttlMs / 1000));
}

export function cacheClearL1(): void {
  l1.clear();
}
