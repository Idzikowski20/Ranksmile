import { emptyPhases, mergePhases, type AnalysisPhases } from '../../lib/analysisPhases';
import { analysisPhaseGroups } from '../../lib/analysisPhaseRows';

function rows(phases: AnalysisPhases = emptyPhases()) {
  const groups = analysisPhaseGroups(phases);
  return Object.fromEntries(groups.map((g) => [g.id, g.rows]));
}

describe('analysisPhaseGroups', () => {
  it('renders two groups in Surfer order: AI Search then Google', () => {
    expect(analysisPhaseGroups(emptyPhases()).map((g) => g.id)).toEqual(['ai-search', 'google']);
  });

  it('shows the crawl counter as detail while crawling', () => {
    const phases = mergePhases(emptyPhases(), {
      fetchingSerp: { status: 'DONE' },
      crawlingSerp: {
        status: 'RUNNING', finished: 6, total: 10, currentUrl: 'https://pl.wikipedia.org/wiki/Detektyw',
      },
    });
    const crawl = rows(phases).google.find((r) => r.id === 'crawling');
    expect(crawl).toMatchObject({
      state: 'active', label: 'Crawling result 6/10', detail: 'pl.wikipedia.org',
    });
  });

  it('labels the crawl generically when no counter arrived yet', () => {
    const phases = mergePhases(emptyPhases(), { crawlingSerp: { status: 'RUNNING' } });
    expect(rows(phases).google.find((r) => r.id === 'crawling')?.label).toBe('Crawling…');
  });

  it('reports the SERP row with its result count once fetched', () => {
    const phases = mergePhases(emptyPhases(), {
      fetchingSerp: { status: 'DONE' },
      crawlingSerp: { status: 'RUNNING', total: 10 },
    });
    expect(rows(phases).google[0]).toMatchObject({ state: 'done', label: 'Got 10 search results' });
  });

  it('marks a phase that errored', () => {
    const phases = mergePhases(emptyPhases(), { aiSearch: { status: 'ERROR', error: 'timeout' } });
    expect(rows(phases)['ai-search'][1]).toMatchObject({ state: 'error', detail: 'timeout' });
  });
});
