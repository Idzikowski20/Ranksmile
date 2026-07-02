import { render, screen } from '@testing-library/react';
import ArticleList from '../../components/articles/ArticleList';

describe('ArticleList empty state', () => {
  it('shows start options when there are no articles', () => {
    render(
      <ArticleList
        articles={[]}
        onDelete={jest.fn()}
        onDeleteMultiple={jest.fn()}
        startLinks={{
          recommendations: '/workspace/12/sites/example-com/recommendations',
          keyword: '/workspace/12/sites/articles/new',
          contentAudit: '/workspace/12/sites/content_audit',
          topicalMap: '/workspace/12/sites/topical-map',
        }}
      />,
    );

    expect(screen.getByText('How do you want to start?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Recommendations Start with one of the suggested actions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Your keyword Create content based on the keyword you provide/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Content Audit Optimize your existing content/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Topical Map Create content based on your existing topics/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Recommendations/i })).toHaveAttribute('href', '/workspace/12/sites/example-com/recommendations');
    expect(screen.getByRole('link', { name: /Your keyword/i })).toHaveAttribute('href', '/workspace/12/sites/articles/new');
    expect(screen.getByRole('link', { name: /Content Audit/i })).toHaveAttribute('href', '/workspace/12/sites/content_audit');
    expect(screen.getByRole('link', { name: /Topical Map/i })).toHaveAttribute('href', '/workspace/12/sites/topical-map');
    expect(screen.queryByText('No articles yet')).not.toBeInTheDocument();
  });
});
