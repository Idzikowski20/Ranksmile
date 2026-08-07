// Shared helper for talking to the Python sidecar — removes the duplicated
// base-URL + POST + error-handling + timeout boilerplate across API routes.

import { isLocalServiceUrl, sidecarUrl } from './serviceUrls';

export { nextjsUrl, publicAppUrl, sidecarUrl } from './serviceUrls';

/** Sidecar base URL (localhost normalised to 127.0.0.1 to dodge IPv6 resolution). */
export function sidecarBase(): string {
   return sidecarUrl();
}

/** True when a reachable sidecar is configured (PYTHON_SIDECAR_URL on Railway, local sidecar in dev). */
export function isSidecarConfigured(): boolean {
   const url = sidecarBase();
   return !isLocalServiceUrl(url) || Boolean(process.env.PYTHON_SIDECAR_URL?.trim());
}

/** Headers every sidecar call must carry — the shared secret that authorises us to
 *  the (publicly deployed) sidecar. Empty locally where the sidecar doesn't enforce it. */
export function sidecarHeaders(extra?: Record<string, string>): Record<string, string> {
   return { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '', ...(extra || {}) };
}

/** POST JSON to a sidecar path and return the parsed result. Throws on non-2xx. */
export async function callSidecar<T = unknown>(path: string, body: unknown, timeoutMs = 60000): Promise<T> {
   const res = await fetch(`${sidecarBase()}${path}`, {
      method: 'POST',
      headers: sidecarHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
   } as RequestInit);
   if (!res.ok) throw new Error((await res.text().catch(() => '')) || `sidecar ${path} failed (${res.status})`);
   return res.json() as Promise<T>;
}
