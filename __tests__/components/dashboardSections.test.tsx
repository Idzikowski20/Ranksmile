import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionTiles from '../../components/dashboard/ActionTiles';
import DashboardArticles, { sortDashboardArticles } from '../../components/dashboard/DashboardArticles';
import GetStartedPanel from '../../components/dashboard/GetStartedPanel';
import type { ArticleCardData } from '../../components/articles/ArticleCard';

const checklist = {
  steps: [] as Array<{ key: string; label: string; done: boolean; href?: string }>,
  beyondSteps: [] as Array<{ key: string; label: string; done: boolean; href?: string }>,
  loading: false,
};
jest.mock('@/hooks/useOnboardingChecklist', () => ({ useOnboardingChecklist: () => checklist }));
const push = jest.fn();
jest.mock('next/router', () => ({ useRouter: () => ({ push, asPath: '/' }) }));

const art = (id: number, title: string, updated: string, created = updated): ArticleCardData => ({
  id, title, status: 'draft', has_content: true, preview_html: `<h1>${title}</h1>`, created_at: created, updated_at: updated,
});

describe('GetStartedPanel', () => {
  beforeEach(() => { localStorage.clear(); });

  it('numbers the steps, ticks the done ones and highlights the next', () => {
    checklist.steps = [
      { key: 'workspace', label: 'Set up your workspace', done: true },
      { key: 'gsc', label: 'Connect Google Search Console', done: false, href: '/settings/gsc' },
      { key: 'content', label: 'Create content that ranks', done: false, href: '/articles' },
    ];
    render(<GetStartedPanel createHref="/articles/new" />);
    const done = screen.getByText('Set up your workspace').closest('.dash-step');
    const active = screen.getByText('Connect Google Search Console').closest('.dash-step');
    const later = screen.getByText('Create content that ranks').closest('.dash-step');
    expect(done).toHaveClass('is-done');
    expect(active).toHaveClass('is-active');
    expect(active).toHaveAttribute('href', '/settings/gsc');
    expect(later).not.toHaveClass('is-active');
    expect(later?.querySelector('.dash-step__num')?.textContent).toBe('3');
    fireEvent.click(screen.getByRole('button', { name: 'Create content' }));
    expect(push).toHaveBeenCalledWith('/articles/new');
  });

  it('stays hidden after the user hides it', () => {
    checklist.steps = [{ key: 'gsc', label: 'Connect Google Search Console', done: false }];
    const { unmount } = render(<GetStartedPanel createHref="/articles/new" />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText('Connect Google Search Console')).not.toBeInTheDocument();
    unmount();
    render(<GetStartedPanel createHref="/articles/new" />);
    expect(screen.queryByText('Connect Google Search Console')).not.toBeInTheDocument();
  });
});

describe('ActionTiles', () => {
  it('links each action', () => {
    render(<ActionTiles tiles={[
      { key: 'create', title: 'Create content', description: 'Write an article with AI', href: '/articles/new', icon: 'NotePencil' },
      { key: 'kw', title: 'Track keywords', description: 'Watch your rankings', href: '/kw', icon: 'ChartLineUp' },
    ]} />);
    expect(screen.getByRole('link', { name: /Create content/ })).toHaveAttribute('href', '/articles/new');
    expect(screen.getByRole('link', { name: /Track keywords/ })).toHaveAttribute('href', '/kw');
  });
});

describe('DashboardArticles', () => {
  const list = [
    art(1, 'Beta', '2026-09-10T00:00:00Z', '2026-09-01T00:00:00Z'),
    art(2, 'Alpha', '2026-09-12T00:00:00Z', '2026-08-01T00:00:00Z'),
  ];

  it('sorts by last edited, created and title', () => {
    expect(sortDashboardArticles(list, 'updated').map((a) => a.id)).toEqual([2, 1]);
    expect(sortDashboardArticles(list, 'created').map((a) => a.id)).toEqual([1, 2]);
    expect(sortDashboardArticles(list, 'title').map((a) => a.id)).toEqual([2, 1]);
  });

  it('shows at most `limit` cards and a way to the rest', () => {
    render(<DashboardArticles articles={[...list, art(3, 'Gamma', '2026-09-01T00:00:00Z')]} hrefFor={(a) => `/articles/${a.id}`} allHref="/articles" limit={2} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/articles');
  });

  it('renders nothing without articles', () => {
    const { container } = render(<DashboardArticles articles={[]} hrefFor={() => '/'} allHref="/articles" />);
    expect(container).toBeEmptyDOMElement();
  });
});
