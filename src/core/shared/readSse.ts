/**
 * Read a `fetch` response that carries server-sent events. EventSource only speaks GET;
 * the outline planner answers a POST. Frames are `event: x\ndata: {json}` separated by
 * a blank line; a frame that fails to parse is skipped.
 */
export default async function readSse(
  res: Response,
  onEvent: (event: string, data: Record<string, unknown>) => void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const event = /^event: (.*)$/m.exec(frame)?.[1];
      const data = /^data: (.*)$/m.exec(frame)?.[1];
      if (event && data) {
        try {
          onEvent(event, JSON.parse(data) as Record<string, unknown>);
        } catch {
          /* a torn frame — the next one carries the state */
        }
      }
    }
  }
}
