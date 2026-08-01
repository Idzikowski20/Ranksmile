import type { NextApiRequest, NextApiResponse } from 'next';

/** Example endpoint disabled in production. */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/nextjs');
  Sentry.logger?.info?.('Sentry example API called');
  throw new Error('Sentry Example API Error');
}
