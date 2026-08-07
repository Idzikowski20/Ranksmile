import { isPublicPath, isPublicRoute } from '../../lib/isPublicPath';

describe('isPublicPath', () => {
  it.each(['/auth/sign-in', '/login', '/drafts/abc', '/invite/x', '/legal/terms', '/dev/tools', '/', '/404', '/no-access'])(
    'treats %s as public',
    (p) => expect(isPublicPath(p)).toBe(true),
  );

  it.each(['/dashboard', '/articles/new', '/sites/example-com/performance'])(
    'treats %s as protected',
    (p) => expect(isPublicPath(p)).toBe(false),
  );
});

describe('isPublicRoute', () => {
  /**
   * The hydration failure. On a not-found page `asPath` is the URL that was typed and
   * `pathname` is `/404`; the shell tested only `asPath`, so an unknown URL looked like a
   * protected route. It then started the auth bootstrap and rendered <AppLoading /> on
   * one side of hydration and the 404 page on the other.
   */
  it('treats a not-found page as public whatever URL produced it', () => {
    expect(isPublicRoute('/sites/articles/new', '/404')).toBe(true);
    expect(isPublicRoute('/anything/at/all', '/404')).toBe(true);
  });

  it('still protects a real route', () => {
    expect(isPublicRoute('/sites/example-com/performance', '/sites/[domain]/performance')).toBe(false);
    expect(isPublicRoute('/workspace/12/dashboard', '/workspace/[wsId]/dashboard')).toBe(false);
  });

  it('ignores the query string', () => {
    expect(isPublicRoute('/auth/sign-in?next=%2Fdashboard', '/auth/sign-in')).toBe(true);
    expect(isPublicRoute('/dashboard?tab=x', '/dashboard')).toBe(false);
  });

  /** Server and client disagree on asPath for statically optimized pages. */
  it('agrees with itself when only asPath is populated', () => {
    expect(isPublicRoute('', '/404')).toBe(true);
    expect(isPublicRoute('/404', '/404')).toBe(true);
  });
});
