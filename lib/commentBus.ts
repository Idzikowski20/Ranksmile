// In-process pub/sub for comment changes, so the editor and the public preview
// can be notified over SSE the moment a comment is added/edited/resolved/deleted —
// no polling. Single Node process (the SerpBear container) means writer and SSE
// listeners share this emitter. Pinned on globalThis so Next dev hot-reload
// doesn't create duplicate emitters.
import { EventEmitter } from 'events';

const g = globalThis as unknown as { __commentBus?: EventEmitter };
const bus: EventEmitter = g.__commentBus || (g.__commentBus = new EventEmitter());
bus.setMaxListeners(0); // one listener per open editor/preview tab; no artificial cap

const channel = (articleId: string | number) => `article:${articleId}`;

export function emitCommentChange(articleId: string | number, payload?: Record<string, unknown>): void {
   bus.emit(channel(articleId), payload || { type: 'change' });
}

/** Subscribe to changes for one article. Returns an unsubscribe function. */
export function onCommentChange(articleId: string | number, cb: (payload: Record<string, unknown>) => void): () => void {
   const ch = channel(articleId);
   bus.on(ch, cb);
   return () => { bus.off(ch, cb); };
}
