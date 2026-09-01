/**
 * What the SSE loop still owes the client, given how much it already sent.
 * A shorter stored text means the job restarted, so the client replays from the top.
 */
// eslint-disable-next-line import/prefer-default-export
export function streamDelta(sentLength: number, full: string): { chunk: string; nextLength: number } {
  if (full.length < sentLength) return { chunk: full, nextLength: full.length };
  return { chunk: full.slice(sentLength), nextLength: full.length };
}
