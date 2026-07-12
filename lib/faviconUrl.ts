/** Build favicon URL via the app proxy (cached server-side). */
export function faviconUrl(domain: string, size = 32): string {
  const d = domain.trim();
  if (!d) return '/api/favicon?v=4&domain=';
  return `/api/favicon?v=4&domain=${encodeURIComponent(d)}&sz=${size}`;
}
