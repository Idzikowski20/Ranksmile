import * as Ably from 'ably';
import { articleChannelName, AblyEventName } from './channel';
import { getErrorMessage } from '../errors';
import { logger } from '../logger';

// Singleton REST client (token minting + server-side publish).
// Module-level so jest.resetModules() clears it between tests; in production
// Next.js/serverless this module is only loaded once per process anyway.
let _rest: Ably.Rest | null | undefined;

function getAblyRest(): Ably.Rest | null {
  if (_rest !== undefined) return _rest;
  const key = process.env.ABLY_API_KEY;
  _rest = key ? new Ably.Rest({ key }) : null;
  return _rest;
}

/**
 * Fire-and-forget publish to an article's realtime channel.
 * NEVER throws — a realtime hiccup must not break the DB write it sits next to.
 * No-ops silently if ABLY_API_KEY is not configured (local/dev without Ably).
 */
export async function publishToArticle(
  articleId: string | number,
  event: AblyEventName,
  data: unknown,
): Promise<void> {
  try {
    const rest = getAblyRest();
    if (!rest) return;
    await rest.channels.get(articleChannelName(articleId)).publish(event, data);
  } catch (err) {
    // Decoupled by design: log and move on. The caller's DB write already succeeded.
    logger.warn('[ably] publish failed', { articleId, event, error: getErrorMessage(err) });
  }
}

export type AblyAccessKind = 'owner' | 'token';

function capabilityFor(articleId: string | number, kind: AblyAccessKind): string {
  const ch = articleChannelName(articleId);
  const ops = kind === 'owner'
    ? ['publish', 'subscribe', 'presence']   // owner is the sole publisher
    : ['subscribe', 'presence'];             // viewers watch + can appear in presence
  return JSON.stringify({ [ch]: ops });
}

/** Mint a short-lived, capability-scoped Ably TokenRequest for the client SDK. */
export async function mintArticleToken(opts: {
  articleId: string | number;
  kind: AblyAccessKind;
  clientId: string;
}): Promise<Ably.TokenRequest> {
  const rest = getAblyRest();
  if (!rest) throw new Error('ABLY_API_KEY not configured');
  return rest.auth.createTokenRequest({
    clientId: opts.clientId,
    capability: capabilityFor(opts.articleId, opts.kind),
  });
}
