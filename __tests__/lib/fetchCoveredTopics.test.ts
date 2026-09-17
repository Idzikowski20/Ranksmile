import { fetchCoveredTopics } from '../../services/article';

it('loads the covered topics of a domain', async () => {
  const fetchMock = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ covered: ['a', 'b'] }) }));
  global.fetch = fetchMock as unknown as typeof fetch;
  await expect(fetchCoveredTopics('my site')).resolves.toEqual(['a', 'b']);
  expect(fetchMock).toHaveBeenCalledWith('/api/articles?domain=my%20site&covered=1');
});

it('fails loudly instead of reporting nothing covered', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })) as unknown as typeof fetch;
  await expect(fetchCoveredTopics('x')).rejects.toThrow('Failed to load covered topics');
});
