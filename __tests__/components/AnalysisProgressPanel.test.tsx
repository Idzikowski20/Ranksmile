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

  it('marks finished rows for assistive tech', () => {
    const phases = mergePhases(emptyPhases(), { fetchingSerp: { status: 'DONE' } });
    render(<AnalysisProgressPanel phases={phases} />);
    expect(screen.getByLabelText('Done: Getting search results')).toBeInTheDocument();
  });
});
