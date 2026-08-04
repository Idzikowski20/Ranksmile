import type { NextApiRequest } from 'next';

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

  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token && token !== 'undefined' && secrets.includes(token)) return true;
  }

  const hdr = req.headers['x-cron-secret'];
  const raw = typeof hdr === 'string' ? hdr.trim() : Array.isArray(hdr) ? (hdr[0] || '').trim() : '';
  if (raw && secrets.includes(raw)) return true;

  return false;
}

/** Header value for outbound cron→app calls (prefers CURRENT). */
export function cronBearerHeader(): string | null {
  const secrets = cronSecrets();
  if (secrets.length === 0) return null;
  return `Bearer ${secrets[0]}`;
}
