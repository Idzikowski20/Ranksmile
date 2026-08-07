import React from 'react';
import { render, screen } from '@testing-library/react';
import AnalysisProgressPanel from '../../components/articles/AnalysisProgressPanel';
import { emptyPhases, mergePhases } from '../../lib/analysisPhases';

describe('AnalysisProgressPanel', () => {
  it('shows both groups', () => {
    render(<AnalysisProgressPanel phases={emptyPhases()} />);
    expect(screen.getByText('AI Search')).toBeInTheDocument();
    expect(screen.getByText('Google Search results')).toBeInTheDocument();
  });

  it('shows the live crawl counter and host', () => {
    const phases = mergePhases(emptyPhases(), {
      fetchingSerp: { status: 'DONE' },
      crawlingSerp: {
        status: 'RUNNING', finished: 6, total: 10, currentUrl: 'https://pl.wikipedia.org/wiki/X',
      },
    });
    render(<AnalysisProgressPanel phases={phases} />);
    expect(screen.getByText('Crawling result 6/10')).toBeInTheDocument();
    expect(screen.getByText('pl.wikipedia.org')).toBeInTheDocument();
  });

  it('announces the step that is running, not the whole panel', () => {
    const phases = mergePhases(emptyPhases(), {
      fetchingSerp: { status: 'DONE' },
      crawlingSerp: { status: 'RUNNING', finished: 6, total: 10 },
    });
    const { container } = render(<AnalysisProgressPanel phases={phases} />);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('In progress: Crawling result 6/10');
  });

  it('announces completion once every step is done', () => {
    const done = mergePhases(emptyPhases(), {
      importingContent: { status: 'DONE' },
      fetchingSerp: { status: 'DONE' },
      crawlingSerp: { status: 'DONE' },
      loadingCompetitors: { status: 'DONE' },
      aiSearch: { status: 'DONE' },
    });
    const { container } = render(<AnalysisProgressPanel phases={done} />);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Analysis complete');
  });

  it('does not claim the run has not started once a step has finished', () => {
    const midRun = mergePhases(emptyPhases(), { fetchingSerp: { status: 'DONE' } });
    const { container } = render(<AnalysisProgressPanel phases={midRun} />);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Analysis in progress');
  });

  it('announces a failure over a step that is still running', () => {
    const failed = mergePhases(emptyPhases(), {
      crawlingSerp: { status: 'RUNNING', finished: 2, total: 10 },
      aiSearch: { status: 'ERROR', error: 'timeout' },
    });
    const { container } = render(<AnalysisProgressPanel phases={failed} />);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('Error');
  });

  it('marks finished rows for assistive tech', () => {
    const phases = mergePhases(emptyPhases(), { fetchingSerp: { status: 'DONE' } });
    render(<AnalysisProgressPanel phases={phases} />);
    expect(screen.getByLabelText('Done: Getting search results')).toBeInTheDocument();
  });
  /** The engine badges are decoration: the group heading already names the sources. */
  it('keeps the engine badges out of the accessibility tree', () => {
    const { container } = render(<AnalysisProgressPanel phases={emptyPhases()} />);
    const svgs = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(svgs.length).toBeGreaterThan(0);
  });

  /**
   * A blank phase set is what the editor renders the instant it opens mid-analysis, so
   * every row has to be listed as pending — not just the two group headings above them.
   */
  it('lists every step from a blank phase set, not just the headings', () => {
    render(<AnalysisProgressPanel phases={emptyPhases()} />);

    for (const label of [
      'Generated prompts',
      'Scraping answers from ChatGPT, AI Overviews, Gemini, AI Mode, Perplexity',
      'Calculating AI Search guidelines',
      'Getting search results',
      'Crawling…',
      'Calculating Content Scores and SEO guidelines',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
