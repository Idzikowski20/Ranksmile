import React from 'react';
import { render, screen } from '@testing-library/react';
import ArticleGenerationSkeleton from '../../components/articles/ArticleGenerationSkeleton';

const setReducedMotion = (reduce: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as typeof window.matchMedia;
};

const bars = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('.koala-skeleton-block'));

describe('ArticleGenerationSkeleton', () => {
  beforeEach(() => setReducedMotion(false));

  it('fills the canvas while a run writes into an empty document', () => {
    const { container } = render(<ArticleGenerationSkeleton busy empty />);
    const skeleton = screen.getByTestId('article-generation-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(bars(container).length).toBeGreaterThan(5);
  });

  /** Real content always wins: the reveal's setContent flips `empty` before the fade starts. */
  it('is gone once the document has content, even mid-run', () => {
    render(<ArticleGenerationSkeleton busy empty={false} />);
    expect(screen.queryByTestId('article-generation-skeleton')).not.toBeInTheDocument();
  });

  it('renders nothing when no run is in flight', () => {
    render(<ArticleGenerationSkeleton busy={false} empty />);
    expect(screen.queryByTestId('article-generation-skeleton')).not.toBeInTheDocument();
  });

  it('shimmers with a stagger by default', () => {
    const { container } = render(<ArticleGenerationSkeleton busy empty />);
    expect(screen.getByTestId('article-generation-skeleton')).toHaveAttribute('data-static', 'false');
    expect(bars(container).some((el) => el.style.animationDelay !== '')).toBe(true);
  });

  it('is a static block under prefers-reduced-motion', () => {
    setReducedMotion(true);
    const { container } = render(<ArticleGenerationSkeleton busy empty />);
    expect(screen.getByTestId('article-generation-skeleton')).toHaveAttribute('data-static', 'true');
    expect(bars(container).every((el) => el.style.animationDelay === '')).toBe(true);
  });

  /** The progress pill owns the announcement — the skeleton is decoration. */
  it('stays out of the accessibility tree', () => {
    render(<ArticleGenerationSkeleton busy empty />);
    expect(screen.getByTestId('article-generation-skeleton')).toHaveAttribute('aria-hidden', 'true');
  });
});
