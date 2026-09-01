import * as Sentry from '@sentry/nextjs';

const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (SENTRY_ENABLED) await import('./sentry.server.config');

    // Schema bootstrap at boot, not inside the first request. Fire-and-forget:
    // a DB outage must not block server start — every route keeps its own
    // memoized ensure* guard as fallback, so failed steps self-heal on first use.
    const { bootstrapSchema } = await import('./lib/schemaBootstrap');
    void bootstrapSchema().catch((err) => console.error('[schema-bootstrap] failed:', err));
  }

  if (SENTRY_ENABLED && process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = SENTRY_ENABLED
  ? Sentry.captureRequestError
  : ((_err: unknown, _request: unknown, _context: unknown) => undefined);
