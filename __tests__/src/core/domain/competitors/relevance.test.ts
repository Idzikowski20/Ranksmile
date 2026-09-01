import { hostOf, isContentCompetitor } from '../../../../../src/core/domain/competitors/relevance';

describe('competitor relevance', () => {
  it('derives a bare host from domain or url', () => {
    expect(hostOf('www.Example.com', '')).toBe('example.com');
    expect(hostOf('', 'https://www.foo.com/x')).toBe('foo.com');
    expect(hostOf('', 'not a url')).toBe('');
  });

  it('drops media/social/tool hosts and their subdomains, keeps real content hosts', () => {
    expect(isContentCompetitor('open.spotify.com', '')).toBe(false);
    expect(isContentCompetitor('youtube.com', '')).toBe(false);
    expect(isContentCompetitor('play.google.com', '')).toBe(false);
    expect(isContentCompetitor('support.google.com', '')).toBe(true); // not a listed subdomain
    expect(isContentCompetitor('example-blog.com', '')).toBe(true);
    expect(isContentCompetitor('', '')).toBe(false);
  });
});
