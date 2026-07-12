jest.mock('../../lib/ssrfGuard', () => ({
  assertPublicUrl: jest.fn(async (rawUrl: string) => {
    if (rawUrl.includes('169.254.169.254')) throw new Error('Blocked private address');
    return new URL(rawUrl);
  }),
}));

import { fetchSitemapUrls } from '../../lib/fetchSitemapUrls';
import { assertPublicUrl } from '../../lib/ssrfGuard';

type MockFetchResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
};

function response(body: string, status = 200, location: string | null = null): MockFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'location' ? location : null) },
    text: async () => body,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('filters private sitemap loc URLs before returning blog URLs', async () => {
  global.fetch = jest.fn().mockResolvedValue(response(`
    <urlset>
      <url><loc>https://example.com/blog/post-one?utm=1</loc></url>
      <url><loc>http://169.254.169.254/latest/meta-data/</loc></url>
    </urlset>
  `)) as unknown as typeof fetch;

  await expect(fetchSitemapUrls('example.com')).resolves.toEqual(['https://example.com/blog/post-one']);
  expect(assertPublicUrl).toHaveBeenCalledWith('http://169.254.169.254/latest/meta-data/');
});

it('does not follow sitemap redirects into private networks', async () => {
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/sitemap.xml')) {
      return response('', 302, 'http://169.254.169.254/sitemap.xml');
    }
    return response('', 404);
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  await expect(fetchSitemapUrls('example.com')).resolves.toEqual([]);
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes('169.254.169.254'))).toBe(false);
});
