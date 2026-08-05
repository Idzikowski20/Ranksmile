import { publicDeepAnalysisError } from '../../lib/deepAnalysisErrors';

describe('publicDeepAnalysisError', () => {
  it.each([
    ['superseded', null, 'Analysis was superseded by a newer run.'],
    ['Pipeline timed out after 180s', 'fetch_page', 'Analysis timed out. Please try again.'],
    ['finalizing timed out', 'finalizing', 'Analysis timed out. Please try again.'],
    ['opaque sidecar failure', 'fetch_page', "Couldn't fetch this page. Check the URL and try again."],
    ['opaque sidecar failure', 'scrape_serp', "Couldn't analyze search results. Please try again."],
    ['opaque sidecar failure', 'finalizing', "Couldn't save the analysis results. Please try again."],
    ['SequelizeConnectionError at 10.0.0.8:5432 C:\\app\\secret.ts', 'score_ranking', 'Deep analysis failed. Please try again.'],
    ['vendor failed at https://internal.example/api', 'unknown_stage', 'Deep analysis failed. Please try again.'],
  ])('maps raw %p at stage %p to a curated message', (rawError, currentStage, expected) => {
    const message = publicDeepAnalysisError(rawError, currentStage);

    expect(message).toBe(expected);
    expect(message).not.toContain('10.0.0.8');
    expect(message).not.toContain('C:\\app');
    expect(message).not.toContain('internal.example');
  });
});
