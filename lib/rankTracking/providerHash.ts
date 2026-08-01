import { createHash } from 'crypto';
import { SERP_PROVIDER } from './constants';

/** Stable JSON for hashing — sorted keys, no undefined. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
      return sorted;
    }
    return v;
  });
}

/**
 * Deterministic hash of provider response for debug
 * ("why did rank move 8→41?" without dumping full raw_items).
 */
export function providerResponseHash(input: {
  provider?: string;
  locationCode: number;
  device: string;
  rawItems: unknown;
}): string {
  const provider = input.provider ?? SERP_PROVIDER;
  const payload = [
    provider,
    String(input.locationCode),
    input.device,
    canonicalJson(input.rawItems),
  ].join('\0');
  return createHash('sha256').update(payload).digest('hex');
}
