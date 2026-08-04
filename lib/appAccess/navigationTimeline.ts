import type { AppState, AppStateReason } from './types';

export type AccessTimelineEvent =
  | {
    type: 'STATE_CHANGED';
    prev: AppState | null;
    next: AppState;
    reason: AppStateReason;
    at: string;
  }
  | {
    type: 'REDIRECT';
    from: string;
    to: string;
    appState: AppState;
    reason: AppStateReason;
    at: string;
  }
  | {
    type: 'REDIRECT_LOOP_BLOCKED';
    key: string;
    at: string;
  };

type Listener = (event: AccessTimelineEvent) => void;

const listeners = new Set<Listener>();

/** Subscribe to access navigation timeline (debug / beacon). Pure side-channel. */
export function subscribeAccessTimeline(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitAccessTimeline(event: AccessTimelineEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // ponytail: never break navigation on telemetry
    }
  }
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug('[access-timeline]', event);
  }
}
