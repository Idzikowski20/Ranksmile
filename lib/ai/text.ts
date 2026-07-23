// Strip emoji / pictographs from Surfy's CHAT reply text (never from article HTML — the article may
// legitimately use emojis). Defensive: the prompt already asks for emoji-free, minimalist prose.
export function stripEmoji(s: string): string {
  if (!s) return s;
  return s
    .replace(/\p{Extended_Pictographic}/gu, '') // emoji pictographs (check/circle/calendar/person …)
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')      // regional-indicator flag halves
    .replace(/[︎️‍]/g, '')         // variation selectors + ZWJ joiners
    .replace(/[ \t]{2,}/g, ' ')                    // collapse the gaps left behind
    .replace(/ +([,.!?:;)])/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/**
 * Split agent stream text into between-tool narration (Thinking) vs final reply.
 * Never fall back to the full stream when the answer slice is empty — that duplicates
 * thinking into the visible message bubble.
 */
export function splitSurfyThinkingAndMessage(
  streamedText: string,
  thinkingLen: number,
): { thinking: string; message: string } {
  const safeLen = Math.max(0, Math.min(thinkingLen, streamedText.length));
  return {
    thinking: streamedText.slice(0, safeLen).trim(),
    message: streamedText.slice(safeLen).trim(),
  };
}

/**
 * Whether the live answer stream should be visible.
 * Once any tool runs in this turn, keep ALL streamed text inside Thinking until `done` —
 * between-tool narration must never appear as the answer bubble (collapsed Thinking leak).
 */
export function shouldShowSurfyAnswerStream(opts: {
  loading: boolean;
  streamAnswer: string;
  hasTools: boolean;
}): boolean {
  if (!opts.loading || !opts.streamAnswer.trim()) return false;
  if (opts.hasTools) return false;
  return true;
}

/**
 * Completed assistant bubbles: only show the Thinking disclosure when there is narration
 * and no final reply yet. Once `message` is present, Thinking chrome above the answer is noise.
 */
export function shouldShowSurfyThinkingDisclosure(
  thinking: string | undefined,
  message: string | undefined,
): boolean {
  const t = (thinking || '').trim();
  if (!t) return false;
  const m = (message || '').trim();
  if (m) return false;
  return true;
}
