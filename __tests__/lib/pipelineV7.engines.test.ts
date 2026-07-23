import { buildJobKey } from '../../lib/pipeline/jobKey';
import { QUEUE_PRIORITY, PIPELINE_VERSION } from '../../lib/pipeline/queuePriorities';
import { termWeight, weightedTermCoverageRatio } from '../../lib/termWeight';
import { computeMultiScore } from '../../lib/engines/multiScore';
import { runCoverageEngine } from '../../lib/engines/coverageEngine';
import { runGapEngine } from '../../lib/engines/gapEngine';
import { runRecommendationEngine } from '../../lib/engines/gapToReco';
import { planActions } from '../../lib/engines/planner';
import { fitCalibration, predictCalibrated, extractFeatureVector } from '../../lib/engines/calibration';
import { diffCorpora } from '../../lib/engines/corpusDiff';
import { serpChangeRatio, shouldForceRefresh } from '../../lib/corpus/serpChange';
import { resolveEntities, heuristicNerExtract } from '../../lib/entities/entityResolver';
import { bm25Rank, assignHarvestToSections } from '../../lib/harvest/bm25';
import { extractKeybertTerms } from '../../lib/semantic/keybert';
import { hashEmbed, cosineSim, findEmbeddingGaps } from '../../lib/semantic/embeddings';
import { computeGeoCues, geoPromptBlock } from '../../lib/geo/geoCues';
import { runLearningLoop } from '../../lib/learning/learningLoopCore';
import { curateConceptsFromTerms } from '../../lib/coverage/curateConcepts';
import { informationGain } from '../../lib/engines/evidence';
import { detectResearchGaps } from '../../lib/engines/gapDetection';

describe('pipeline v7 foundation', () => {
  it('builds stable job keys', () => {
    const a = buildJobKey({ workspaceId: 1, keyword: 'SEO Tools', jobType: 'serp_crawl' });
    const b = buildJobKey({ workspaceId: 1, keyword: 'seo  tools', jobType: 'serp_crawl' });
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it('exposes numeric priorities', () => {
    expect(QUEUE_PRIORITY.live_score).toBeGreaterThan(QUEUE_PRIORITY.planner);
    expect(QUEUE_PRIORITY.planner).toBeGreaterThan(QUEUE_PRIORITY.embeddings);
    expect(PIPELINE_VERSION).toMatch(/^v7/);
  });

  it('registers all workers by default (PIPELINE_STAGE=5)', async () => {
    const prev = process.env.PIPELINE_STAGE;
    delete process.env.PIPELINE_STAGE;
    const { listWorkers, getWorker, resetWorkerRegistry } = await import('../../lib/workers/registry');
    resetWorkerRegistry();
    const ids = listWorkers().map((w) => w.id);
    expect(ids).toEqual(
      expect.arrayContaining(['coverage', 'live_score', 'serp', 'planner', 'embeddings']),
    );
    expect(getWorker('serp_crawl')?.id).toBe('serp');
    expect(getWorker('planner')).toBeDefined();
    if (prev === undefined) delete process.env.PIPELINE_STAGE;
    else process.env.PIPELINE_STAGE = prev;
    resetWorkerRegistry();
  });

  it('registers only Etap 0 workers when PIPELINE_STAGE=0', async () => {
    const prev = process.env.PIPELINE_STAGE;
    process.env.PIPELINE_STAGE = '0';
    const { listWorkers, getWorker, resetWorkerRegistry } = await import('../../lib/workers/registry');
    resetWorkerRegistry();
    const ids = listWorkers().map((w) => w.id).sort();
    expect(ids).toEqual(['coverage', 'live_score', 'serp']);
    expect(getWorker('serp_crawl')?.id).toBe('serp');
    expect(getWorker('planner')).toBeUndefined();
    if (prev === undefined) delete process.env.PIPELINE_STAGE;
    else process.env.PIPELINE_STAGE = prev;
    resetWorkerRegistry();
  });
});

describe('Etap 1 score engines', () => {
  it('termWeight boosts high doc_freq', () => {
    const rare = termWeight({ term: 'x', doc_freq: 1, corpusSize: 10 });
    const common = termWeight({ term: 'y', doc_freq: 8, corpusSize: 10 });
    expect(common).toBeGreaterThan(rare);
  });

  it('weighted coverage prefers SERP-heavy terms', () => {
    const ratio = weightedTermCoverageRatio(
      'alpha alpha beta',
      [
        { term: 'alpha', doc_freq: 9, target_count: 2, corpusSize: 10 },
        { term: 'gamma', doc_freq: 1, target_count: 2, corpusSize: 10 },
      ],
      (text, term) => (text.match(new RegExp(term, 'gi')) || []).length,
    );
    expect(ratio).toBeGreaterThan(0.4);
  });

  it('Coverage → Gap → Reco pipeline', () => {
    const covered = runCoverageEngine({
      keyword: 'detektyw warszawa',
      terms: [
        { term: 'detektyw', doc_freq: 8 },
        { term: 'agencja detektywistyczna', doc_freq: 6 },
      ],
      paaQuestions: [{ question: 'Ile kosztuje detektyw w Warszawie?' }],
    });
    expect(covered.byType.term?.length || covered.byType.concept?.length).toBeGreaterThan(0);
    expect(covered.byType.entity ?? []).toHaveLength(0);

    const gaps = runGapEngine({
      items: covered.items,
      plainText: 'Krótki tekst bez pokrycia.',
    });
    expect(gaps.gaps.length).toBeGreaterThan(0);

    const recos = runRecommendationEngine({ gaps: gaps.gaps, articleId: 1 });
    expect(recos.actions.length).toBeGreaterThan(0);
    expect(recos.actions[0].origin).toBe('coverage');
  });

  it('multi-score produces overall', () => {
    const m = computeMultiScore({ seo: 70, ai: 60, coverage: 50, geo: 40 });
    expect(m.overall).toBeGreaterThan(40);
    expect(m.overall).toBeLessThanOrEqual(100);
  });

  it('information gain is non-negative', () => {
    expect(informationGain({ priorCoverage: 0.2, posteriorCoverage: 0.5 })).toBeGreaterThan(0);
  });

  it('curateConcepts never labels ENTITY', () => {
    const c = curateConceptsFromTerms({
      keyword: 'test',
      terms: [{ term: 'foo bar', doc_freq: 5 }, { term: 'baz', doc_freq: 3 }],
    });
    expect(c.entities).toHaveLength(0);
    expect(c.concepts[0]?.type).toBe('concept');
    expect(c.terms[0]?.type).toBe('term');
  });
});

describe('Etap 1.5 NER', () => {
  it('resolves entities from spans', () => {
    const resolved = resolveEntities([
      { text: 'OpenAI', label: 'ORG', score: 0.9 },
      { text: 'Open AI', label: 'ORG', score: 0.8 },
    ]);
    expect(resolved.length).toBeGreaterThanOrEqual(1);
  });

  it('heuristic extract returns spans', () => {
    const spans = heuristicNerExtract('Warsaw Detective Agency works with Google Cloud.');
    expect(spans.length).toBeGreaterThan(0);
  });
});

describe('Etap 2 planner / geo / serp change', () => {
  it('plans by ROI', () => {
    const plan = planActions({
      actions: [
        {
          id: 'a1',
          type: 'add_entity',
          title: 'A',
          instruction: 'x',
          expectedLift: 10,
          confidence: 0.9,
          cost: 'easy',
          reason: 'r',
          origin: 'coverage',
          appliesTo: { kind: 'article' },
        },
        {
          id: 'a2',
          type: 'expand_section',
          title: 'B',
          instruction: 'y',
          expectedLift: 12,
          confidence: 0.5,
          cost: 'large',
          reason: 'r',
          origin: 'coverage',
          appliesTo: { kind: 'article' },
        },
      ],
    });
    expect(plan.ranked[0].id).toBe('a1');
  });

  it('GEO cues score extractability', () => {
    const cues = computeGeoCues(
      '<h1>Q</h1><p>Answer early. More.</p><script type="application/ld+json">{}</script><a href="https://a.com">x</a><a href="https://b.com">y</a>',
      'Answer early. More text here for the opener paragraph content.',
    );
    expect(cues.score).toBeGreaterThan(30);
    expect(geoPromptBlock(cues).length).toBeGreaterThanOrEqual(0);
  });

  it('SERP change threshold', () => {
    const ratio = serpChangeRatio(
      ['https://a.com', 'https://b.com', 'https://c.com'],
      ['https://a.com', 'https://d.com', 'https://e.com'],
    );
    expect(shouldForceRefresh(ratio, 0.3)).toBe(true);
  });
});

describe('Etap 2b calibration', () => {
  it('fits and predicts without LLM', () => {
    const model = fitCalibration([
      { featureVector: [10, 0.5, 1, 0, 0, 0, 0, 0, 0, 0], outcome: 20 },
      { featureVector: [80, 0.9, 8, 0, 0, 0, 0, 0, 0, 0], outcome: 85 },
    ]);
    const mid = predictCalibrated(model, [50, 0.7, 4, 0, 0, 0, 0, 0, 0, 0]);
    expect(mid).toBeGreaterThan(20);
    expect(mid).toBeLessThan(90);
  });
});

describe('Etap 3 knowledge / diff / bm25', () => {
  it('diffs corpora into planner signals', () => {
    const d = diffCorpora({
      prevUrls: ['https://a.com', 'https://b.com', 'https://c.com'],
      nextUrls: ['https://a.com', 'https://x.com', 'https://y.com'],
      prevVersion: 1,
      nextVersion: 2,
      prevTerms: ['a', 'b'],
      nextTerms: ['a', 'c', 'd'],
    });
    expect(d.signals.length).toBeGreaterThan(0);
  });

  it('BM25 ranks and assigns harvest', () => {
    const ranked = bm25Rank({
      query: 'koszt detektywa',
      docs: [
        { id: '1', text: 'koszt usług detektywa w Warszawie' },
        { id: '2', text: 'pogoda jutro' },
      ],
    });
    expect(ranked[0].id).toBe('1');

    const assigned = assignHarvestToSections({
      questions: [{ id: 'q1', text: 'ile kosztuje detektyw' }],
      sections: [
        { id: 's1', heading: 'Cennik', body: 'ile kosztuje detektyw i ceny usług' },
        { id: 's2', heading: 'Kontakt', body: 'telefon email' },
      ],
    });
    expect(assigned[0]?.sectionId).toBe('s1');
  });

  it('detectResearchGaps combines coverage + organic', () => {
    const items = runCoverageEngine({
      keyword: 'test',
      terms: [{ term: 'alpha', doc_freq: 5 }],
    }).items;
    const { gaps } = detectResearchGaps({
      items,
      plainText: 'bez pokrycia',
      organicQueries: ['alpha beta query missing'],
    });
    expect(gaps.length).toBeGreaterThan(0);
  });
});

describe('Etap 4 semantic', () => {
  it('KeyBERT + hash embeddings', () => {
    const terms = extractKeybertTerms('Content optimization for SEO search engines ranking factors', {
      topK: 5,
    });
    expect(terms.length).toBeGreaterThan(0);
    const a = hashEmbed('hello world');
    const b = hashEmbed('hello world');
    expect(cosineSim(a, b)).toBeGreaterThan(0.99);
    const gaps = findEmbeddingGaps({
      articleText: 'cats',
      corpusTexts: [
        { id: '1', text: 'dogs and wolves hunting' },
        { id: '2', text: 'cats meow' },
      ],
      threshold: 0.9,
    });
    expect(gaps.some((g) => g.id === '1')).toBe(true);
  });
});

describe('Etap 5 learning', () => {
  it('learning loop returns calibration + hints', () => {
    const feature = {
      id: 'f1',
      version: 1,
      createdAt: new Date().toISOString(),
      score: { score: 40, confidence: 0.5, version: 1, contributors: [] },
      confidence: 0.5,
      signals: [{ id: 's', key: 'k', value: 3 }],
      actions: [],
    };
    const update = runLearningLoop({
      features: [feature],
      outcomes: [70],
      diffSignals: [
        {
          kind: 'serp_churn',
          severity: 'high',
          detail: 'SERP flipped',
          score: 60,
        },
      ],
    });
    expect(update.calibration.samples).toBe(1);
    expect(update.plannerHints.some((h) => /Re-plan|Calibration/.test(h))).toBe(true);
    expect(extractFeatureVector(feature).length).toBeGreaterThan(2);
  });
});
