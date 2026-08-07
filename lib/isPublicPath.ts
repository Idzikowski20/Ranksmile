/** Routes that skip Neon Auth client bootstrap (marketing, auth UI, drafts). */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/auth')
    || pathname.startsWith('/login')
    || pathname.startsWith('/drafts')
    || pathname.startsWith('/invite')
    || pathname.startsWith('/legal')
    || pathname.startsWith('/dev')
    || pathname === '/'
    || pathname === '/404'
    || pathname === '/no-access'
  );

}

/**
 * Public-route test for a live router, from both of its path signals.
 *
 * `asPath` is the URL the user is on; `pathname` is the route Next matched. They differ
 * exactly where it matters here: on a not-found page `asPath` is whatever was typed
 * (`/sites/articles/new`) while `pathname` is `/404`. Testing `asPath` alone made every
 * unknown URL look like a protected route, so the shell started the auth bootstrap on the
 * 404 page — and rendered a different tree on each side of hydration.
 */
export function isPublicRoute(asPath: string, pathname: string): boolean {
  return isPublicPath((asPath || '').split('?')[0]) || isPublicPath(pathname);
}
