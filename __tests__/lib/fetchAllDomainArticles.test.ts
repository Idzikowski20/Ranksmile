import { fetchAllDomainArticles } from '../../services/article';

it('pages through every article of the domain', async () => {
  const pages: Record<string, unknown> = {
    0: { articles: [{ title: 'A' }, { title: 'B' }], hasMore: true },
    2: { articles: [{ title: 'C' }], hasMore: false },
  };
  const fetchMock = jest.fn((url: string) => {
    const offset = new URL(url, 'http://x').searchParams.get('offset') ?? '0';
    return Promise.resolve({ json: () => Promise.resolve(pages[offset]) });
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  const out = await fetchAllDomainArticles('my site');
  expect(out.articles.map((a) => a.title)).toEqual(['A', 'B', 'C']);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/articles?domain=my%20site&limit=100&offset=0');
});
