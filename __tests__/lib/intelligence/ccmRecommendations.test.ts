import { compile } from '@/src/core/compiler/compile';
import { buildActionGraph } from '@/src/core/planner/actionGraphBuilder';
import {
  recommendationKindLabel,
  summarizeRecommendations,
} from '@/src/core/intelligence/ccmRecommendations';
import { projectArticleIntelligence } from '@/src/core/intelligence/runtimeApi';

const FIXED_AT = '2026-08-03T18:00:00.000Z';

describe('ccmRecommendations', () => {
  it('summarizes ActionGraph into UI DTO + view.recommendations', () => {
    const { model } = compile({
      articleId: 'rec-1',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text: '# Temat\n\nKrótki tekst bez faktów o Krymie.',
      },
    });
    const ag = buildActionGraph(model, { builtAt: FIXED_AT });
    const recs = summarizeRecommendations(ag, 5);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.promptFragment.length).toBeGreaterThan(0);
    expect(recommendationKindLabel(recs[0]!.kind).length).toBeGreaterThan(0);

    const view = projectArticleIntelligence(model, ag);
    expect(view.recommendations.length).toBeGreaterThan(0);
    expect(view.recommendations[0]!.id).toBe(recs[0]!.id);
  });
});
