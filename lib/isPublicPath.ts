/** Routes that skip Neon Auth client bootstrap (marketing, auth UI, drafts). */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/auth')
    || pathname.startsWith('/login')
    || pathname.startsWith('/drafts')
    || pathname.startsWith('/invite')
    || pathname === '/'
    || pathname === '/homepage'
  );
}
