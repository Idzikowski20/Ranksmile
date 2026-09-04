import { render, screen, waitFor } from '@testing-library/react';
import CompetitorOutlinesPanel from '../../components/articles/CompetitorOutlinesPanel';

jest.mock('../../components/common/DomainFavicon', () => ({
  __esModule: true,
  default: () => null,
}));
// The scanned-score lookup is react-query; the panel must render (with the peer estimate)
// without a QueryClient, exactly as it does before the store has scanned anything.
jest.mock('../../services/competitors', () => ({
  useCompetitors: () => ({ data: undefined }),
}));

const CACHED = JSON.stringify({
  competitors: [
    {
      url: 'https://a.pl/uslugi',
      domain: 'a.pl',
      title: 'Detektyw Warszawa',
      word_count: 2100,
      heading_count: 14,
      serp_position: 1,
      headings: [{ level: 2, text: 'Zakres usług' }],
    },
    {
      url: 'https://b.pl/',
      domain: 'b.pl',
      title: 'Biuro detektywistyczne',
      word_count: 1800,
      heading_count: 11,
      serp_position: 2,
      headings: [{ level: 2, text: 'Cennik' }],
    },
  ],
});

const props = { articleId: 1, keyword: 'prywatny detektyw warszawa', cachedOutlines: CACHED };

it('renders the cached competitors without hitting the network', async () => {
  render(<CompetitorOutlinesPanel {...props} />);

  expect(await screen.findByText('Detektyw Warszawa')).toBeInTheDocument();
  expect(screen.getByText('Biuro detektywistyczne')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
});

/**
 * Outline review uses this as the side column itself, so there is nowhere to go "back" to.
 */
it('drops the back button when it is the whole column', async () => {
  render(<CompetitorOutlinesPanel {...props} />);

  await screen.findByText('Detektyw Warszawa');
  expect(screen.queryByTitle('Back')).toBeNull();
});

it('keeps the back button when opened on top of another panel', async () => {
  render(<CompetitorOutlinesPanel {...props} onClose={() => undefined} />);

  await waitFor(() => expect(screen.getByTitle('Back')).toBeInTheDocument());
});

/**
 * The panel used to carry its own "Generate brief" action calling a second outline
 * generator (`/api/articles/generate-outline`), competing with the editor's bottom bar
 * over the same outline. It is gone in both modes — not merely hidden in one.
 */
it.each([
  ['on top of another panel', { onClose: () => undefined }],
  ['as the whole column', {}],
])('never offers a second outline generator %s', async (_mode, extra) => {
  render(<CompetitorOutlinesPanel {...props} {...extra} />);

  await screen.findByText('Detektyw Warszawa');
  expect(screen.queryByRole('button', { name: /Generate brief/ })).toBeNull();
});

/** Outline review used to show the competitors without the score every other view has. */
it('grades every competitor with a gauge, peer-relative when nothing was scanned', async () => {
  const { container } = render(<CompetitorOutlinesPanel {...props} />);

  await screen.findByText('Detektyw Warszawa');
  // The longer, more-structured page is the peer median or above: 100. The other lands
  // below it on both words and headings.
  expect(screen.getByText('100')).toBeInTheDocument();
  expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
});

/** The list is the panel's only scroll container; without minHeight 0 it grew past the
 *  card and `overflow: hidden` cut the last competitors off. */
it('lets the list scroll instead of growing past the card', async () => {
  render(<CompetitorOutlinesPanel {...props} />);
  await screen.findByText('Detektyw Warszawa');

  const scroller = document.querySelector('.styled-scrollbar') as HTMLElement;
  expect(scroller.style.overflowY).toBe('auto');
  expect(scroller.style.minHeight).toBe('0');
});

/** The counts feed the gauge; on the card they pushed the domain onto a second line. */
it('shows the domain without the word and heading counts', async () => {
  render(<CompetitorOutlinesPanel {...props} />);

  expect(await screen.findByText('a.pl')).toBeInTheDocument();
  expect(screen.queryByText(/2,100/)).toBeNull();
  expect(screen.queryByText(/14h/)).toBeNull();
});
