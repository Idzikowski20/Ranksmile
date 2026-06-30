// Shared by both server (publish) and client (subscribe). NO Ably import here —
// keep it dependency-free so it can be imported anywhere (incl. the browser bundle).

/** One Ably channel per article carries all three realtime streams. */
export function articleChannelName(articleId: string | number): string {
  return `article:${articleId}`;
}

/** Event names published on the article channel. */
export const ABLY_EVENTS = {
  content: 'content',
  caret: 'caret',
  comment: 'comment',
} as const;

export type AblyEventName = typeof ABLY_EVENTS[keyof typeof ABLY_EVENTS];
