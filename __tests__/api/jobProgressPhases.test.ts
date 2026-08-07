import {
  emptyPhases, mergePhases, phasesFromStage,
  type AnalysisPhases, type AnalysisPhasesPatch,
} from '../../lib/analysisPhases';
import { safeJsonParse } from '../../lib/safeJson';

/**
 * The handler is thin; what matters is the merge contract it must follow — an explicit
 * patch wins, a stage-only event falls back to the stage map, and earlier phases survive.
 */
function storedPhases(prevJson: string | null, body: {
  currentStage?: string; stageProgress?: number; phases?: AnalysisPhasesPatch;
}) {
  const prev = safeJsonParse<AnalysisPhases | null>(prevJson, null);
  const patch = body.phases ?? phasesFromStage(body.currentStage || '', body.stageProgress ?? 0);
  return mergePhases(prev, patch);
}

describe('job-progress phase persistence', () => {
  it('derives phases from a stage-only event', () => {
    expect(storedPhases(null, { currentStage: 'scrape_serp', stageProgress: 100 }).fetchingSerp.status)
      .toBe('DONE');
  });

  it('prefers an explicit phase patch over the stage fallback', () => {
    const stored = storedPhases(JSON.stringify(emptyPhases()), {
      currentStage: 'scrape_serp',
      stageProgress: 0,
      phases: { crawlingSerp: { status: 'RUNNING', finished: 3, total: 10 } },
    });
    expect(stored.crawlingSerp.finished).toBe(3);
    expect(stored.fetchingSerp.status).toBe('NEW');
  });

  it('keeps earlier phases when a later event arrives', () => {
    const first = storedPhases(null, { currentStage: 'scrape_serp', stageProgress: 100 });
    const second = storedPhases(JSON.stringify(first), { currentStage: 'ai_search', stageProgress: 0 });
    expect(second.fetchingSerp.status).toBe('DONE');
    expect(second.aiSearch.status).toBe('RUNNING');
  });

  it('starts from empty when the stored value is corrupt', () => {
    const stored = storedPhases('{not json', { currentStage: 'ai_search', stageProgress: 0 });
    expect(stored.crawlingSerp.status).toBe('NEW');
    expect(stored.aiSearch.status).toBe('RUNNING');
  });
});
