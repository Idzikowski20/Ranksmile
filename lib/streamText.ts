/** Generation streams append here; the cap stops a runaway writer filling the row. */
export const MAX_STREAM_CHARS = 400_000;

export function appendChunk(prev: string | null, chunk: string): string {
  if (!chunk) return prev ?? '';
  const next = (prev ?? '') + chunk;
  return next.length > MAX_STREAM_CHARS ? next.slice(0, MAX_STREAM_CHARS) : next;
}
