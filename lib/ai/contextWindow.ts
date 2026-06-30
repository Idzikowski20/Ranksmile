// Context-window usage for the Surfy chat ring (Twenty-style: conversation tokens vs the model's
// context window, NOT an arbitrary budget). deepseek-chat has a 64K context window.
import { formatTokens } from './sse';

export const CONTEXT_WINDOW_TOKENS = 500_000;

/** Ring/bar colour by how full the context window is: green ≤50%, yellow ≤75%, orange ≤90%, red >90%. */
export function contextUsageColor(pct: number): string {
  if (pct > 90) return '#ef4444'; // red
  if (pct > 75) return '#f97316'; // orange
  if (pct > 50) return '#eab308'; // yellow
  return '#1ab25e'; // green
}

/** pct (0–100) of the context window used by the current conversation. */
export function contextUsagePct(conversationTokens: number, contextWindow = CONTEXT_WINDOW_TOKENS): number {
  if (!Number.isFinite(conversationTokens) || conversationTokens <= 0 || contextWindow <= 0) return 0;
  return Math.min((conversationTokens / contextWindow) * 100, 100);
}

export { formatTokens };
