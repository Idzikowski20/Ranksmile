// Server-Sent Events helpers for the streaming Surfy agent route. Pure + unit-testable.

/** One SSE frame. `data` is JSON-encoded; `event` names group client handling. */
export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Compact token label for the usage ring: 980 → "980", 12345 → "12.3k". */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  return n < 1000 ? String(Math.round(n)) : `${(n / 1000).toFixed(1)}k`;
}
