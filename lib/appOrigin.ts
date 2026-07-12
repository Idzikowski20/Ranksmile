import type { NextApiRequest } from 'next';

export function getAppOrigin(req?: NextApiRequest): string {
  const fromEnv = process.env.APP_BASE_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.AUTH0_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const host = req?.headers.host;
  if (host) {
    const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    return `${proto}://${host}`;
  }

  return 'http://localhost:3000';
}
