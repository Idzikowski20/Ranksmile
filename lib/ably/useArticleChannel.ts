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

export type UseArticleChannel = {
  channel: Ably.RealtimeChannel | null;
  connectionState: Ably.ConnectionState | 'idle';
};

/**
 * Returns a live Ably channel for the article (or null while idle), plus the live
 * connection state for UX (toast). One Realtime connection per mount; authed by
 * /api/ably-token (capability-scoped). Resync is the caller's job via onReconnect.
 */
export function useArticleChannel({ articleId, shareToken, clientId, onReconnect }: Params): UseArticleChannel {
  const [channel, setChannel] = useState<Ably.RealtimeChannel | null>(null);
  const [connectionState, setConnectionState] = useState<Ably.ConnectionState | 'idle'>('idle');
  // Keep the latest onReconnect without re-creating the connection on each render.
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => { onReconnectRef.current = onReconnect; }, [onReconnect]);

  useEffect(() => {
    if (articleId == null) return undefined;

    const authParams: Record<string, string> = { articleId: String(articleId) };
    if (shareToken) authParams.token = shareToken;
    if (clientId) authParams.clientId = clientId;

    const client = new Ably.Realtime({
      authUrl: '/api/ably-token',
      authMethod: 'GET',
      authParams,
      closeOnUnload: true,
    });

    let hasConnectedOnce = false;
    const onState = (change: Ably.ConnectionStateChange) => {
      setConnectionState(change.current);
      if (change.current === 'connected') {
        if (hasConnectedOnce) onReconnectRef.current?.(); // a RE-connect → resync
        hasConnectedOnce = true;
      }
    };
    client.connection.on(onState);

    const ch = client.channels.get(articleChannelName(articleId));
    setChannel(ch);

    return () => {
      setChannel(null);
      setConnectionState('idle');
      try { client.connection.off(onState); } catch { /* ignore */ }
      // detach() returns a Promise that rejects with "Connection closed" during teardown —
      // try/catch only traps a sync throw, so swallow the async rejection explicitly.
      try { ch.detach().catch(() => {}); } catch { /* ignore */ }
      try { client.close(); } catch { /* ignore */ }
    };
  }, [articleId, shareToken, clientId]);

  return { channel, connectionState };
}
