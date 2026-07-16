import { useEffect, useRef, useState } from 'react';
import * as Ably from 'ably';
import { articleChannelName } from './channel';

// Note: pass a STABLE onReconnect (e.g. wrapped in useCallback). An inline arrow
// re-runs the ref-sync effect every parent render — harmless, but avoidable.

type Params = {
  articleId: string | number | null | undefined;
  /** Share token for viewers; omit for the owner (session-authed). */
  shareToken?: string | null;
  /** Display name → becomes the Ably clientId (for presence/caret identity). */
  clientId?: string | null;
  /** Fired after a DROPPED connection is restored (not on the first connect).
   *  The viewer uses this to refetch the latest doc and resync. */
  onReconnect?: () => void;
};

/** Close a Realtime client without surfacing Ably's expected teardown rejections. */
function safeCloseClient(client: Ably.Realtime) {
  const state = client.connection.state;
  if (state === 'closed' || state === 'closing') return;
  try {
    const result = client.close() as void | Promise<unknown>;
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch { /* ignore */ }
}

const OFFLINE_STATES = new Set<Ably.ConnectionState>(['closed', 'failed', 'suspended', 'disconnected']);

type AblyTokenProbe = { disabled?: boolean };

async function fetchAblyToken(query: string): Promise<Ably.TokenRequest | 'disabled' | null> {
  const res = await fetch(`/api/ably-token?${query}`, { credentials: 'include' });
  if (res.status === 503) return 'disabled';
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({})) as AblyTokenProbe & Ably.TokenRequest;
  if (data.disabled) return 'disabled';
  return data;
}

/** Cached after first disabled probe — avoids hammering /api/ably-token when ABLY_API_KEY is unset. */
let ablyDisabled = false;

export type UseArticleChannel = {
  channel: Ably.RealtimeChannel | null;
  connectionState: Ably.ConnectionState | 'idle';
};

/**
 * Returns a live Ably channel for the article (or null while idle), plus the live
 * connection state for UX (toast). One Realtime connection per mount; authed by
 * /api/ably-token (capability-scoped). Resync is the caller's job via onReconnect.
 *
 * The channel is only exposed once the connection is `connected` so presence/subscribe
 * never attach against a closing socket (avoids Next.js "Connection closed" overlay).
 *
 * When ABLY_API_KEY is not configured the hook stays idle (no Realtime client, no retries).
 */
export function useArticleChannel({ articleId, shareToken, clientId, onReconnect }: Params): UseArticleChannel {
  const [channel, setChannel] = useState<Ably.RealtimeChannel | null>(null);
  const [connectionState, setConnectionState] = useState<Ably.ConnectionState | 'idle'>('idle');
  // Keep the latest onReconnect without re-creating the connection on each render.
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => { onReconnectRef.current = onReconnect; }, [onReconnect]);

  useEffect(() => {
    if (articleId == null || ablyDisabled) return undefined;

    let active = true;

    const authParams: Record<string, string> = { articleId: String(articleId) };
    if (shareToken) authParams.token = shareToken;
    if (clientId) authParams.clientId = clientId;

    const query = new URLSearchParams(authParams).toString();
    let client: Ably.Realtime | null = null;
    let onState: ((change: Ably.ConnectionStateChange) => void) | null = null;

    (async () => {
      const token = await fetchAblyToken(query);
      if (!active) return;
      if (token === 'disabled') {
        ablyDisabled = true;
        return;
      }
      if (!token) return;
      if (!active) return;

      client = new Ably.Realtime({
        authCallback: (_params, callback) => {
          fetchAblyToken(query)
            .then((next) => {
              if (next === 'disabled') {
                ablyDisabled = true;
                callback('Ably disabled', null);
                return;
              }
              if (!next) {
                callback('Auth failed', null);
                return;
              }
              callback(null, next);
            })
            .catch((err: Error) => { callback(err.message, null); });
        },
        closeOnUnload: false,
      });

      const ch = client.channels.get(articleChannelName(articleId));
      let hasConnectedOnce = false;

      const onStateHandler = (change: Ably.ConnectionStateChange) => {
        if (!active) return;
        setConnectionState(change.current);
        if (change.current === 'connected') {
          setChannel(ch);
          if (hasConnectedOnce) onReconnectRef.current?.();
          hasConnectedOnce = true;
        } else if (OFFLINE_STATES.has(change.current)) {
          setChannel(null);
        }
      };
      onState = onStateHandler;
      client.connection.on(onStateHandler);

      if (client.connection.state === 'connected') {
        setChannel(ch);
        hasConnectedOnce = true;
        setConnectionState('connected');
      }
    })().catch(() => {});

    return () => {
      active = false;
      setChannel(null);
      setConnectionState('idle');
      if (client) {
        try {
          if (onState) client.connection.off(onState);
        } catch { /* ignore */ }
        const clientToClose = client;
        queueMicrotask(() => safeCloseClient(clientToClose));
      }
    };
  }, [articleId, shareToken, clientId]);

  return { channel, connectionState };
}
