import {
  competitorsFromScoreData,
  enrichWithCorpusClaims,
  enrichWithWieSynthesis,
  diagnosePlannerInputs,
} from '../../../lib/contentPlanner/fromArticleInputs';
import { buildCompetitorProfiles } from '../../../lib/contentPlanner/competitorIntelligence';
import { buildCompetitorBenchmark, synthesizeCompetitors } from '../../../lib/contentPlanner/competitorBenchmark';
import { buildTargetKnowledgeGraph } from '../../../lib/contentPlanner/knowledgeIntelligence';
import { buildArticleBlueprint } from '../../../lib/contentPlanner/budgetEngine';
import { buildIntentBlueprint } from '../../../lib/contentPlanner/intentBlueprint';
import { buildReaderModel } from '../../../lib/contentPlanner/readerModel';
import { heuristicCompetitorSynthesis } from '../../../lib/wie/competitorSynthesis';

const SHARED = 'Licencja detektywistyczna jest wymagana przez ustawe z 2001 roku.';

const serpCompetitors = Array.from({ length: 5 }, (_, i) => ({
  url: `https://c${i}.pl/uslugi`, position: i + 1, word_count: 2000, headings: 14, p_count: 40,
}));

/** Four of five pages repeat SHARED; each also states something only it says. */
const competitorClaims: Record<string, string[]> = {
  'https://c0.pl/uslugi': [SHARED, 'Stawka godzinowa wynosi od 150 zlotych.'],
  'https://c1.pl/uslugi': [SHARED, 'Polisa OC jest obowiazkowa dla agencji.'],
  'https://c2.pl/uslugi': [SHARED, 'Wpis do rejestru MSWiA jest wymagany.'],
  'https://www.c3.pl/uslugi/': [SHARED, 'Raport jest dowodem w postepowaniu sadowym.'],
  'https://c4.pl/uslugi': ['Obserwacja trwa zwykle od 3 do 10 dni.'],
};

function plan(scoreData: Record<string, unknown>) {
  let competitors = competitorsFromScoreData(scoreData);
  competitors = enrichWithCorpusClaims(competitors, scoreData.competitor_claims ?? null);
  competitors = enrichWithWieSynthesis(competitors, scoreData.competitor_synthesis ?? null);
  const profiles = buildCompetitorProfiles(competitors);
  const kg = buildTargetKnowledgeGraph({ profiles, ai: {}, paaQuestions: [] });
  const intent = buildIntentBlueprint({ keyword: 'detektyw krakow', language: 'pl' });
  const reader = buildReaderModel({ intent, language: 'pl' });
  const benchmark = buildCompetitorBenchmark(synthesizeCompetitors(profiles));
  return {
    competitors,
    kg,
    blueprint: buildArticleBlueprint({ benchmark, kg, intent, reader }),
  };
}

describe('corpus claims in the planner', () => {
  it('spreads claims across the competitors that actually made them', () => {
    const { competitors } = plan({ competitors: serpCompetitors, competitor_claims: competitorClaims });

    expect(competitors.map((c) => (c.claims || []).length)).toEqual([2, 2, 2, 2, 1]);
  });

  /**
   * The point of per-competitor extraction. With every claim attached to competitor[0]
   * each one had frequency 1, so `classifyGain` labelled the entire graph `opportunity`
   * and the whole gain/priority ranking collapsed into a single bucket.
   */
  it('separates what every competitor says from what only one does', () => {
    const { kg } = plan({ competitors: serpCompetitors, competitor_claims: competitorClaims });

    const shared = kg.claims.find((c) => c.statement === SHARED);
    const unique = kg.claims.find((c) => c.statement.includes('3 do 10 dni'));
    expect(shared?.gainClass).toBe('core');
    expect(unique?.gainClass).toBe('opportunity');
    expect(new Set(kg.claims.map((c) => c.gainClass)).size).toBeGreaterThan(1);
  });

  /** The corpus and the outlines cache disagree on www and trailing slashes. */
  it('matches urls that differ only by www or a trailing slash', () => {
    const { competitors } = plan({ competitors: serpCompetitors, competitor_claims: competitorClaims });

    expect(competitors[3].claims).toHaveLength(2);
  });

  it('clears the five-claim plan gate from corpus claims alone', () => {
    const { blueprint } = plan({ competitors: serpCompetitors, competitor_claims: competitorClaims });

    expect(blueprint.targetClaims).toBeGreaterThanOrEqual(5);
  });

  it('leaves the synthesis fallback in place when no page could be read', () => {
    const synthesis = heuristicCompetitorSynthesis({
      keyword: 'detektyw krakow',
      corpusTexts: [],
    });
    const { competitors } = plan({ competitors: serpCompetitors, competitor_synthesis: synthesis });

    expect((competitors[0].claims || []).length).toBeGreaterThan(0);
  });
});

describe('diagnosePlannerInputs', () => {
  const cases: Array<[string, Parameters<typeof diagnosePlannerInputs>[0], string]> = [
    ['analysis still running', { scoreData: null, competitorCount: 0, claimCount: 0, analysisRunning: true }, 'analysis_running'],
    ['running wins over a thin topic',
      { scoreData: { competitor_claims: {} }, competitorCount: 5, claimCount: 2, analysisRunning: true },
      'analysis_running'],
    ['no score data at all', { scoreData: null, competitorCount: 0, claimCount: 0 }, 'no_analysis'],
    ['analysis ran but found no competitors', { scoreData: { terms: [] }, competitorCount: 0, claimCount: 0 }, 'no_analysis'],
    ['competitors found but none readable', { scoreData: { terms: [] }, competitorCount: 5, claimCount: 0 }, 'competitors_unreadable'],
    ['pages read, still too thin', { scoreData: { competitor_claims: { a: ['x'] } }, competitorCount: 5, claimCount: 3 }, 'thin_topic'],
    ['synthesis alone counts as readable', { scoreData: { competitor_synthesis: {} }, competitorCount: 5, claimCount: 4 }, 'thin_topic'],
  ];

  it.each(cases)('%s', (_label, input, expected) => {
    expect(diagnosePlannerInputs(input).code).toBe(expected);
  });

  /** Telling someone to re-run an analysis that never ran sends them in a circle. */
  it('does not tell the user to re-run an analysis that never ran', () => {
    const gap = diagnosePlannerInputs({ scoreData: null, competitorCount: 0, claimCount: 0 });

    expect(gap.message).toMatch(/Run the article analysis first/);
    expect(gap.message).not.toMatch(/Re-run/);
  });
});

/**
 * Mid-analysis the article legitimately has nothing yet. Telling the reader to start an
 * analysis that is already running points them at a button that refuses to fire.
 */
describe('diagnosePlannerInputs while an analysis is in flight', () => {
  it('never asks the user to run or re-run anything', () => {
    const gap = diagnosePlannerInputs({
      scoreData: null, competitorCount: 0, claimCount: 0, analysisRunning: true,
    });

    expect(gap.message).not.toMatch(/[Rr]un the article analysis|Re-run/);
    expect(gap.message).toMatch(/still running/);
  });
});
