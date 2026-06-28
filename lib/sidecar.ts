// Shared helper for talking to the Python sidecar — removes the duplicated
// base-URL + POST + error-handling + timeout boilerplate across API routes.

/** Sidecar base URL (localhost normalised to 127.0.0.1 to dodge IPv6 resolution). */
export function sidecarBase(): string {
   return (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
}

/** Headers every sidecar call must carry — the shared secret that authorises us to
 *  the (publicly deployed) sidecar. Empty locally where the sidecar doesn't enforce it. */
export function sidecarHeaders(extra?: Record<string, string>): Record<string, string> {
   return { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '', ...(extra || {}) };
}

/** POST JSON to a sidecar path and return the parsed result. Throws on non-2xx. */
export async function callSidecar<T = any>(path: string, body: unknown, timeoutMs = 60000): Promise<T> {
   const res = await fetch(`${sidecarBase()}${path}`, {
      method: 'POST',
      headers: sidecarHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
   } as RequestInit);
   if (!res.ok) throw new Error((await res.text().catch(() => '')) || `sidecar ${path} failed (${res.status})`);
   return res.json() as Promise<T>;
}
