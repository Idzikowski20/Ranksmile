import type { NextApiRequest } from 'next';
import { timingSafeEqualText } from '@/src/infrastructure/crypto/timingSafeEqualText';

/** Bearer secrets accepted for platform cron/system endpoints (fail-closed). */
export function cronSecrets(): string[] {
  const current = (process.env.CRON_SECRET_CURRENT || process.env.CRON_SECRET || '').trim();
  const previous = (process.env.CRON_SECRET_PREVIOUS || '').trim();
  const out: string[] = [];
  if (current) out.push(current);
  if (previous && previous !== current) out.push(previous);
  return out;
}

export function assertCronSecret(req: NextApiRequest): boolean {
  const secrets = cronSecrets();
  if (secrets.length === 0) return false;

  let candidate = '';
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    candidate = auth.slice('Bearer '.length).trim();
  } else {
    const hdr = req.headers['x-cron-secret'];
    candidate = typeof hdr === 'string' ? hdr.trim() : Array.isArray(hdr) ? (hdr[0] || '').trim() : '';
  }
  if (!candidate || candidate === 'undefined') return false;

  // Compare against every accepted secret so rotation does not leak which slot matched.
  let ok = false;
  for (const secret of secrets) {
    if (timingSafeEqualText(candidate, secret)) ok = true;
  }
  return ok;
}

/** Header value for outbound cron→app calls (prefers CURRENT). */
export function cronBearerHeader(): string | null {
  const secrets = cronSecrets();
  if (secrets.length === 0) return null;
  return `Bearer ${secrets[0]}`;
}
