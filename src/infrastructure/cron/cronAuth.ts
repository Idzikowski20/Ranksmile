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

function headerCandidate(req: NextApiRequest): string {
  const hdr = req.headers['x-cron-secret'];
  return typeof hdr === 'string' ? hdr.trim() : Array.isArray(hdr) ? (hdr[0] || '').trim() : '';
}

function bearerCandidate(req: NextApiRequest): string {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  return '';
}

export function assertCronSecret(req: NextApiRequest): boolean {
  const secrets = cronSecrets();
  if (secrets.length === 0) return false;

  // Bearer and x-cron-secret are independent alternatives. A junk Authorization
  // must not hide a valid x-cron-secret (and vice versa).
  const candidates = [bearerCandidate(req), headerCandidate(req)]
    .filter((value, i, all) => value && value !== 'undefined' && all.indexOf(value) === i);

  let ok = false;
  for (const value of candidates) {
    for (const secret of secrets) {
      if (timingSafeEqualText(value, secret)) ok = true;
    }
  }
  return ok;
}

/** Header value for outbound cron→app calls (prefers CURRENT). */
export function cronBearerHeader(): string | null {
  const secrets = cronSecrets();
  if (secrets.length === 0) return null;
  return `Bearer ${secrets[0]}`;
}
