// Context-window usage for the Surfy chat ring (Twenty-style: conversation tokens vs the model's
// context window, NOT an arbitrary budget). deepseek-chat has a 64K context window.
import { formatTokens } from './sse';

export const CONTEXT_WINDOW_TOKENS = 64_000;

/** Ring/bar colour by how full the context window is: accent <60%, amber 60–80%, red >80%. */
export function contextUsageColor(pct: number): string {
  if (pct > 80) return '#ef4444';
  if (pct > 60) return '#d97706';
  return '#783afb';
}

/** pct (0–100) of the context window used by the current conversation. */
export function contextUsagePct(conversationTokens: number, contextWindow = CONTEXT_WINDOW_TOKENS): number {
  if (!Number.isFinite(conversationTokens) || conversationTokens <= 0 || contextWindow <= 0) return 0;
  return Math.min((conversationTokens / contextWindow) * 100, 100);
}

export { formatTokens };
