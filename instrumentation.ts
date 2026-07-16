import * as Sentry from '@sentry/nextjs';

const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true';

export async function register() {
  if (!SENTRY_ENABLED) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = SENTRY_ENABLED
  ? Sentry.captureRequestError
  : ((_err: unknown, _request: unknown, _context: unknown) => undefined);
