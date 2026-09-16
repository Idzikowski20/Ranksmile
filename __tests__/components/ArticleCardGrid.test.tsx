import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ArticleCardGrid from '../../components/articles/ArticleCardGrid';
import ArticleEmptyStart from '../../components/articles/ArticleEmptyStart';
import type { ArticleCardData } from '../../components/articles/ArticleCard';

const art = (id: number, title: string): ArticleCardData => ({
  id, title, status: 'draft', has_content: true, preview_html: `<h1>${title}</h1>`,
  created_at: '2026-09-16T08:00:00.000Z', updated_at: '2026-09-16T08:00:00.000Z',
});

describe('ArticleCardGrid', () => {
  it('shows the start options when there are no articles', () => {
    render(
      <ArticleCardGrid
        articles={[]}
        hrefFor={(a) => `/articles/${a.id}`}
        emptyState={<ArticleEmptyStart links={{ recommendations: '/r', keyword: '/k', contentAudit: '/c' }} />}
      />,
    );
    expect(screen.getByText('How do you want to start?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Your keyword/i })).toHaveAttribute('href', '/k');
  });

  it('collects a selection and deletes it in one go', async () => {
    const onDeleteMultiple = jest.fn().mockResolvedValue(undefined);
    render(
      <ArticleCardGrid
        articles={[art(1, 'A'), art(2, 'B')]}
        hrefFor={(a) => `/articles/${a.id}`}
        onDelete={jest.fn()}
        onDeleteMultiple={onDeleteMultiple}
      />,
    );
    const selects = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(selects[0]);
    fireEvent.click(selects[1]);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Put in trash' }));
    await waitFor(() => expect(onDeleteMultiple).toHaveBeenCalledWith([1, 2]));
    await waitFor(() => expect(screen.queryByText('2 selected')).not.toBeInTheDocument());
  });

  it('renders a skeleton while loading', () => {
    const { container } = render(<ArticleCardGrid articles={[]} hrefFor={() => '/'} isLoading skeletonCount={3} />);
    expect(container.querySelectorAll('.article-card--skeleton')).toHaveLength(3);
  });
});
