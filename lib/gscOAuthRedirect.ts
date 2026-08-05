/**
 * Post-OAuth landing after GSC Google consent.
 * Legacy WP plugin used `redirect=/wordpress` (old Integration page, removed).
 */
export function resolveGscPostOAuthRedirect(redirect: string | null | undefined): string {
  const fallback = '/settings/google_search_console';
  if (typeof redirect !== 'string' || !redirect.startsWith('/') || redirect.startsWith('//')) {
    return fallback;
  }
  if (redirect === '/wordpress') return fallback;
  return redirect;
}
