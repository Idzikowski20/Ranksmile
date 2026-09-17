/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import AddEventDialog from '../../components/automations/AddEventDialog';

const RECS = {
  recommendations: [
    { title: 'Local SEO checklist', type: 'create', search_volume: 1200 },
    { title: 'Fix slow pages', type: 'optimize', search_volume: 50 },
    { title: 'Link building', type: 'create', search_volume: null },
  ],
};

const GSC = {
  data: {
    thirtyDays: [
      { keyword: 'audyt seo cena', impressions: 126, position: 58.9, clicks: 0, page: '/a' },
      { keyword: 'covered keyword', impressions: 300, position: 4, clicks: 9, page: '/b' },
      { keyword: 'too quiet', impressions: 12, position: 30, clicks: 0, page: '/c' },
    ],
  },
};
const ARTICLES = { articles: [{ title: 'Covered keyword guide', target_keyword: 'covered keyword' }] };

function mockApi(recs: unknown = RECS) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const u = String(url);
    let body: unknown = { suggestions: [], hasVolumeData: false };
    if (u.includes('/recommendations')) body = recs;
    else if (u.includes('/api/gsc/search-data')) body = GSC;
    else if (u.startsWith('/api/articles?')) body = ARTICLES;
    return Promise.resolve({ ok: true, json: async () => body });
  }) as unknown as typeof fetch;
}

beforeEach(() => mockApi());

function setup(over: Partial<React.ComponentProps<typeof AddEventDialog>> = {}) {
  const onSubmit = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AddEventDialog
        open
        onClose={jest.fn()}
        slug="idztech-pl"
        country="PL"
        initialDate="2026-09-18"
        wordpressConnected
        onSubmit={onSubmit}
        {...over}
      />
    </QueryClientProvider>,
  );
  return { onSubmit };
}

// The keyword field (its placeholder disappears once a chip exists, so find it by type).
const addTyped = (kw: string) => {
  const input = document.querySelector('input[type="text"]') as HTMLInputElement;
  fireEvent.change(input, { target: { value: kw } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

it('asks only for a date and keywords — no article title field', () => {
  setup();
  expect(screen.queryByText('Article title')).toBeNull();
  expect(screen.getByText('Publish date')).toBeInTheDocument();
  expect(screen.getByText('Main keywords')).toBeInTheDocument();
  expect(screen.getByText(/1 keyword = 1 article/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Schedule' })).toBeDisabled();
});

it('offers Content ideas as one-click keywords and numbers each keyword as its own article', async () => {
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Add Local SEO checklist' }));
  expect(screen.queryByRole('button', { name: 'Add Fix slow pages' })).toBeNull(); // optimize rows aren't ideas
  addTyped('seo audit');
  expect(screen.getByLabelText('Article 1')).toBeInTheDocument();
  expect(screen.getByLabelText('Article 2')).toBeInTheDocument();
  expect(screen.getByText('2 keywords = 2 articles.')).toBeInTheDocument();
  // An added idea leaves the suggestion list.
  expect(screen.queryByRole('button', { name: 'Add Local SEO checklist' })).toBeNull();
});

it('submits the date, every keyword and the publish mode', async () => {
  const { onSubmit } = setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Add Link building' }));
  addTyped('seo audit');
  addTyped('SEO audit'); // duplicate, ignored
  fireEvent.click(screen.getByRole('button', { name: 'Schedule 2 articles' }));
  expect(onSubmit).toHaveBeenCalledWith({
    scheduledDate: '2026-09-18',
    keywords: ['Link building', 'seo audit'],
    publishMode: 'draft',
  });
});

it('blocks a live schedule without WordPress', async () => {
  setup({ wordpressConnected: false });
  addTyped('seo audit');
  fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
  fireEvent.click(screen.getByRole('button', { name: 'Live' }));
  expect(screen.getByText('WordPress not connected')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Schedule 1 article' })).toBeDisabled();
});

it('suggests Search Console content ideas even when the domain has no create recommendations', async () => {
  mockApi({ recommendations: [] });
  setup();
  const chip = await screen.findByRole('button', { name: 'Add audyt seo cena' });
  expect(chip).toHaveTextContent('126 impr.');
  expect(screen.queryByRole('button', { name: 'Add covered keyword' })).toBeNull(); // an article covers it
  expect(screen.queryByRole('button', { name: 'Add too quiet' })).toBeNull(); // 20 impressions or fewer
});
