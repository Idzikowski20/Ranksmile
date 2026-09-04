import readSse from '@/src/core/shared/readSse';

/** A Response whose body arrives in the given chunks. */
function response(chunks: string[]): Response {
  const queue = chunks.map((c) => new TextEncoder().encode(c));
  return {
    body: {
      getReader: () => ({
        read: async () => (queue.length
          ? { done: false, value: queue.shift() }
          : { done: true, value: undefined }),
      }),
    },
  } as unknown as Response;
}

const collect = async (chunks: string[]) => {
  const seen: Array<[string, Record<string, unknown>]> = [];
  await readSse(response(chunks), (event, data) => { seen.push([event, data]); });
  return seen;
};

it('dispatches every frame, however the chunks cut them', async () => {
  const frames = 'event: status\ndata: {"done":1,"total":2}\n\nevent: status\ndata: {"done":2,"total":2}\n\nevent: done\ndata: {"ok":true}\n\n';
  const whole = await collect([frames]);
  // Cut mid-frame, mid-JSON and between frames — the buffer has to reassemble all three.
  const split = await collect([frames.slice(0, 20), frames.slice(20, 61), frames.slice(61)]);
  const expected = [
    ['status', { done: 1, total: 2 }],
    ['status', { done: 2, total: 2 }],
    ['done', { ok: true }],
  ];
  expect(whole).toEqual(expected);
  expect(split).toEqual(expected);
});

it('skips a frame whose JSON is torn and keeps reading', async () => {
  const seen = await collect(['event: status\ndata: {"done":1\n\nevent: done\ndata: {"ok":true}\n\n', ':hb\n\n']);
  expect(seen).toEqual([['done', { ok: true }]]);
});

it('lets the handler abort the read by throwing', async () => {
  await expect(readSse(response(['event: error\ndata: {"error":"boom"}\n\n']), (event, data) => {
    if (event === 'error') throw new Error(String(data.error));
  })).rejects.toThrow('boom');
});

it('resolves at once for a response with no body', async () => {
  const seen: string[] = [];
  await readSse({} as Response, (event) => { seen.push(event); });
  expect(seen).toEqual([]);
});
