import { compile } from '../../../lib/compiler/compile';
import { buildActionGraph } from '../../../lib/planner/actionGraphBuilder';
import { summarizeRecommendations } from '../../../lib/intelligence/ccmRecommendations';
import { ccmRecommendationsToEditCandidates } from '../../../lib/intelligence/ccmToEditCandidates';
import { collectPrecisionCandidates } from '../../../lib/ao/runPrecisionOptimize';
import { buildProfileFromContext } from '../../../lib/ao/runPrecisionOptimize';

const FIXED_AT = '2026-08-03T22:00:00.000Z';

describe('ccmRecommendationsToEditCandidates', () => {
  it('maps CCM recs into EditCandidates with ccm: gapIds', () => {
    const { model } = compile({
      articleId: 'ao-ccm',
      compiledAt: FIXED_AT,
      source: { kind: 'plain', text: '# Temat\n\nKrótki tekst bez Krymu.' },
    });
    const ag = buildActionGraph(model, { builtAt: FIXED_AT });
    const recs = summarizeRecommendations(ag, 5);
    expect(recs.length).toBeGreaterThan(0);
    const cands = ccmRecommendationsToEditCandidates(recs);
    expect(cands.length).toBe(recs.length);
    expect(cands.every((c) => c.gapId.startsWith('ccm:rec:'))).toBe(true);
    expect(cands.every((c) => c.source === 'ai_coverage')).toBe(true);
  });

  it('collectPrecisionCandidates merges extraCandidates by gapId', () => {
    const { model } = compile({
      articleId: 'ao-merge',
      compiledAt: FIXED_AT,
      source: { kind: 'plain', text: '# A\n\nTekst.' },
    });
    const ag = buildActionGraph(model, { builtAt: FIXED_AT });
    const extra = ccmRecommendationsToEditCandidates(summarizeRecommendations(ag, 3));
    const profile = buildProfileFromContext(null, '<p>Tekst.</p>');
    const merged = collectPrecisionCandidates({
      ctx: null,
      html: '<p>Tekst.</p>',
      profile,
      extraCandidates: extra,
    });
    const ccmCount = merged.filter((c) => c.gapId.startsWith('ccm:rec:')).length;
    expect(ccmCount).toBe(extra.length);
  });
});
