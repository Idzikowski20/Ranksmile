/** Public production hosts — overridden by env when set. */
export const PRODUCTION_APP_URL = 'https://serp-bear-neon.vercel.app';
export const PRODUCTION_SIDECAR_URL = 'https://serpbear-sidecar.onrender.com';

export const LOCAL_NEXTJS_URL = 'http://127.0.0.1:3000';
export const LOCAL_SIDECAR_URL = 'http://127.0.0.1:8001';

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

function normalizeLocalhost(url: string): string {
  return url.replace('localhost', '127.0.0.1').replace(/\/$/, '');
}

/** Next.js base URL for server-to-server callbacks (sidecar → Node). */
export function nextjsUrl(): string {
  const explicit = process.env.NEXTJS_URL?.trim() || process.env.APP_BASE_URL?.trim();
  if (explicit) return normalizeLocalhost(explicit);

  const publicApp = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (publicApp && isProductionRuntime()) return normalizeLocalhost(publicApp);

  if (isProductionRuntime()) return PRODUCTION_APP_URL;
  return LOCAL_NEXTJS_URL;
}

/** Browser-facing app URL (links, redirects). */
export function publicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return normalizeLocalhost(explicit);
  if (isProductionRuntime()) return PRODUCTION_APP_URL;
  return 'http://localhost:3000';
}

/** Python sidecar base URL (Node → sidecar). */
export function sidecarUrl(): string {
  const explicit = process.env.PYTHON_SIDECAR_URL?.trim() || process.env.SIDECAR_URL?.trim();
  if (explicit) return normalizeLocalhost(explicit);
  if (isProductionRuntime()) return PRODUCTION_SIDECAR_URL;
  return LOCAL_SIDECAR_URL;
}

export function isLocalServiceUrl(url: string): boolean {
  return /\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(url.replace('localhost', '127.0.0.1'));
}
