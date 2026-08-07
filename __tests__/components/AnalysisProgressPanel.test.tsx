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
});
