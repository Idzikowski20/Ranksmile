import { render, screen } from '@testing-library/react';
import ArticleCard, { relativeEditTime, type ArticleCardData } from '../../components/articles/ArticleCard';

const base: ArticleCardData = {
  id: 7,
  title: 'Najemca nie płaci czynszu — co zrobić',
  status: 'draft',
  publish_url: null,
  preview_html: '<h1>Najemca nie płaci czynszu</h1><p>Wezwanie do zapłaty otwiera drogę.</p>',
  has_content: true,
  is_outline: false,
  seo_score: 80,
  ai_score: 60,
  created_at: '2026-09-16T08:00:00.000Z',
  updated_at: '2026-09-16T08:00:00.000Z',
};

describe('ArticleCard', () => {
  it('renders the article body as the thumbnail, with its score on the page', () => {
    const { container } = render(<ArticleCard article={base} href="/articles/7" />);
    expect(container.querySelector('.article-card__doc h1')?.textContent).toBe('Najemca nie płaci czynszu');
    expect(container.querySelector('.article-card__score')).not.toBeNull();
    expect(screen.getByRole('link', { name: base.title })).toHaveAttribute('href', '/articles/7');
  });

  it('says what a click leads to', () => {
    const { rerender } = render(<ArticleCard article={{ ...base, is_outline: true }} href="/a" />);
    expect(screen.getByText('Waiting review')).toBeInTheDocument();
    rerender(<ArticleCard article={base} href="/a" />);
    expect(screen.getByText('Being edited')).toBeInTheDocument();
    rerender(<ArticleCard article={{ ...base, publish_url: 'https://x.pl/a' }} href="/a" />);
    expect(screen.getByText('Published')).toBeInTheDocument();
    rerender(<ArticleCard article={{ ...base, status: 'generating', has_content: false }} href="/a" />);
    expect(screen.getByText('Generating')).toBeInTheDocument();
  });

  it('shows placeholder lines instead of an empty page when there is nothing to preview', () => {
    const { container } = render(<ArticleCard article={{ ...base, preview_html: '', has_content: false }} href="/a" />);
    expect(container.querySelector('.article-card__placeholder')).not.toBeNull();
    expect(container.querySelector('.article-card__doc')).toBeNull();
  });

  it('credits the last editor', () => {
    render(<ArticleCard article={base} href="/a" author={{ name: 'Matt Frugal' }} />);
    expect(screen.getByText('Matt Frugal')).toBeInTheDocument();
  });

  it('offers edit, delete and select only when handlers are given', () => {
    const onDelete = jest.fn();
    const onSelect = jest.fn();
    render(<ArticleCard article={base} href="/a" onDelete={onDelete} onSelect={onSelect} />);
    screen.getByRole('button', { name: 'Delete' }).click();
    screen.getByRole('button', { name: 'Select' }).click();
    expect(onDelete).toHaveBeenCalledWith(7);
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it('formats the edit time the way the reference does', () => {
    const now = new Date('2026-09-16T10:00:00.000Z').getTime();
    expect(relativeEditTime('2026-09-16T09:40:00.000Z', now)).toBe('20 mins ago');
    expect(relativeEditTime('2026-09-16T07:00:00.000Z', now)).toBe('3 hours ago');
    expect(relativeEditTime('2026-09-14T10:00:00.000Z', now)).toBe('2 days ago');
  });
});
