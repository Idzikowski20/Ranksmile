import { readJsonResponse } from '@/src/core/shared/readJsonResponse';

const response = (body: string, status = 200) => ({ status, text: async () => body }) as unknown as Response;

it('returns the parsed body', async () => {
  await expect(readJsonResponse(response('{"ok":true}'))).resolves.toEqual({ ok: true });
});

/** Ask Smily showed "Unexpected token '<', "<!DOCTYPE"…" — a parser message, not a diagnosis. */
it('names an HTML page and its status instead of the parser error', async () => {
  await expect(readJsonResponse(response('<!DOCTYPE html><html>…', 500)))
    .rejects.toThrow('The server answered with a page instead of data (HTTP 500).');
});

it('quotes a short non-JSON body with its status', async () => {
  await expect(readJsonResponse(response('Body exceeded 1mb limit', 413)))
    .rejects.toThrow('Unexpected server response (HTTP 413): Body exceeded 1mb limit');
});
