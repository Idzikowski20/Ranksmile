import { render, screen, waitFor } from '@testing-library/react';
import CompetitorOutlinesPanel from '../../components/articles/CompetitorOutlinesPanel';

jest.mock('../../components/common/DomainFavicon', () => ({
  __esModule: true,
  default: () => null,
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
it('never offers a second outline generator', async () => {
  render(<CompetitorOutlinesPanel {...props} onClose={() => undefined} />);

  await screen.findByText('Detektyw Warszawa');
  expect(screen.queryByRole('button', { name: /Generate brief/ })).toBeNull();
});
