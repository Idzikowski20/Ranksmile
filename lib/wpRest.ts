/**
 * Calls a WordPress REST route in a way that survives broken pretty-permalink
 * routing. Some hosts (e.g. LiteSpeed without the right rewrite, or sites on
 * "Plain" permalinks) 404 the `/wp-json/...` form while the equivalent
 * `?rest_route=/...` form — which WordPress always exposes — works fine.
 *
 * We try the pretty form first (keeps nice URLs where they work) and fall back
 * to `?rest_route=` when it 404s or doesn't answer with JSON.
 */
export async function wpRestFetch(siteUrl: string, route: string, init?: RequestInit): Promise<Response> {
   const base = siteUrl.replace(/\/+$/, '');
   const clean = route.replace(/^\/+/, '');

   try {
      const pretty = await fetch(`${base}/wp-json/${clean}`, init);
      const ct = pretty.headers.get('content-type') || '';
      if (pretty.status !== 404 && ct.includes('json')) return pretty;
   } catch { /* network error on the pretty form — try the fallback below */ }

   return fetch(`${base}/?rest_route=/${clean}`, init);
}
