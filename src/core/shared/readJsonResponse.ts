/**
 * Parse a fetch response as JSON, naming what actually came back when it is not.
 *
 * `res.json()` on an HTML error page throws "Unexpected token '<', "<!DOCTYPE"…" — a
 * message about the parser, not the request. The status and the shape of the body are
 * what the reader needs: a 500 page from the dev server, a 404 page for a route that is
 * not there, a 413 text from the body limit.
 */
// eslint-disable-next-line import/prefer-default-export
export async function readJsonResponse<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const page = /^\s*<(!doctype|html)/i.test(text);
    throw new Error(page
      ? `The server answered with a page instead of data (HTTP ${res.status}).`
      : `Unexpected server response (HTTP ${res.status}): ${text.slice(0, 80)}`);
  }
}
