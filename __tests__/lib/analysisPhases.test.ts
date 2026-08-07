import {
  emptyPhases, mergePhases, phasesFromStage,
} from '../../lib/analysisPhases';

describe('mergePhases', () => {
  it('starts every phase as NEW', () => {
    expect(emptyPhases().crawlingSerp).toEqual({
      status: 'NEW', finished: null, total: null, currentUrl: null, error: null,
    });
  });

  it('merges a patch without dropping untouched phases', () => {
    const next = mergePhases(emptyPhases(), {
      crawlingSerp: {
        status: 'RUNNING', finished: 6, total: 10, currentUrl: 'https://pl.wikipedia.org/x',
      },
    });
    expect(next.crawlingSerp.finished).toBe(6);
    expect(next.fetchingSerp.status).toBe('NEW');
  });

  it('keeps a finished phase finished when a coarse stage event follows', () => {
    const done = mergePhases(emptyPhases(), { crawlingSerp: { status: 'DONE', finished: 10, total: 10 } });
    const after = mergePhases(done, phasesFromStage('classify_content', 0));
    expect(after.crawlingSerp.status).toBe('DONE');
    expect(after.loadingCompetitors.status).toBe('RUNNING');
  });

  it('refuses to reopen a DONE phase with an explicit RUNNING patch', () => {
    const done = mergePhases(emptyPhases(), { crawlingSerp: { status: 'DONE', finished: 10, total: 10 } });
    const after = mergePhases(done, { crawlingSerp: { status: 'RUNNING', finished: 3, total: 10 } });
    expect(after.crawlingSerp.status).toBe('DONE');
    expect(after.crawlingSerp.finished).toBe(3);
  });

  it('still lets a phase move forward from RUNNING', () => {
    const running = mergePhases(emptyPhases(), { aiSearch: { status: 'RUNNING' } });
    expect(mergePhases(running, { aiSearch: { status: 'DONE' } }).aiSearch.status).toBe('DONE');
  });

  it('treats null previous state as empty', () => {
    expect(mergePhases(null, { fetchingSerp: { status: 'DONE' } }).fetchingSerp.status).toBe('DONE');
  });
});

describe('phasesFromStage', () => {
  it('maps a finished scrape_serp stage to a done fetch and a running crawl', () => {
    expect(phasesFromStage('scrape_serp', 100)).toEqual({
      fetchingSerp: { status: 'DONE' },
      crawlingSerp: { status: 'RUNNING' },
    });
  });

  it('maps ai_search to our AI Search phase', () => {
    expect(phasesFromStage('ai_search', 0).aiSearch).toEqual({ status: 'RUNNING' });
    expect(phasesFromStage('ai_search', 100).aiSearch).toEqual({ status: 'DONE' });
  });

  it('ignores stages that have no phase of their own', () => {
    expect(phasesFromStage('score_ranking', 0)).toEqual({});
  });
});
