import { resolveGscPostOAuthRedirect } from '../../lib/gscOAuthRedirect';

describe('resolveGscPostOAuthRedirect', () => {
  it('maps legacy plugin redirect=/wordpress to GSC settings', () => {
    expect(resolveGscPostOAuthRedirect('/wordpress')).toBe('/settings/google_search_console');
  });

  it('keeps explicit GSC settings redirect', () => {
    expect(resolveGscPostOAuthRedirect('/settings/google_search_console')).toBe(
      '/settings/google_search_console',
    );
  });

  it('falls back for missing or unsafe targets', () => {
    expect(resolveGscPostOAuthRedirect(null)).toBe('/settings/google_search_console');
    expect(resolveGscPostOAuthRedirect('https://evil.example')).toBe('/settings/google_search_console');
    expect(resolveGscPostOAuthRedirect('//evil.example')).toBe('/settings/google_search_console');
  });
});
