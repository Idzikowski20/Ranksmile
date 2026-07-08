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
 */
export function useArticleChannel({ articleId, shareToken, clientId, onReconnect }: Params): UseArticleChannel {
  const [channel, setChannel] = useState<Ably.RealtimeChannel | null>(null);
  const [connectionState, setConnectionState] = useState<Ably.ConnectionState | 'idle'>('idle');
  // Keep the latest onReconnect without re-creating the connection on each render.
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => { onReconnectRef.current = onReconnect; }, [onReconnect]);

  useEffect(() => {
    if (articleId == null) return undefined;

    let active = true;

    const authParams: Record<string, string> = { articleId: String(articleId) };
    if (shareToken) authParams.token = shareToken;
    if (clientId) authParams.clientId = clientId;

    const client = new Ably.Realtime({
      authUrl: '/api/ably-token',
      authMethod: 'GET',
      authParams,
      // Lifecycle is managed by this effect's cleanup — avoid double-close on unload.
      closeOnUnload: false,
    });

    const ch = client.channels.get(articleChannelName(articleId));

    let hasConnectedOnce = false;

    const onState = (change: Ably.ConnectionStateChange) => {
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
    client.connection.on(onState);

    if (client.connection.state === 'connected') {
      setChannel(ch);
      hasConnectedOnce = true;
      setConnectionState('connected');
    }

    return () => {
      active = false;
      try { client.connection.off(onState); } catch { /* ignore */ }
      setChannel(null);
      setConnectionState('idle');
      const clientToClose = client;
      queueMicrotask(() => safeCloseClient(clientToClose));
    };
  }, [articleId, shareToken, clientId]);

  return { channel, connectionState };
}
