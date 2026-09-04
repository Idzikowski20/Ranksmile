/**
 * Read a `fetch` response that carries server-sent events. EventSource only speaks GET;
 * the outline planner and Ask Smily answer a POST. Frames are `event: x\ndata: {json}`
 * separated by a blank line and may arrive split across chunks; a frame whose JSON does
 * not parse is skipped. Whatever the handler throws propagates to the caller.
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
      const parsed = parseFrame(frame);
      if (parsed) onEvent(parsed.event, parsed.data);
    }
  }
}

function parseFrame(frame: string): { event: string; data: Record<string, unknown> } | null {
  const event = /^event: (.*)$/m.exec(frame)?.[1];
  const raw = /^data: (.*)$/m.exec(frame)?.[1];
  if (!event || !raw) return null;
  try {
    return { event, data: JSON.parse(raw) as Record<string, unknown> };
  } catch {
    return null;
  }
}
