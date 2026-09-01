import { carriedScoreData } from '@/src/core/domain/articles/carriedScoreData';

/**
 * Article 17 shipped with `knowledge_graph: null`, no `content_planner_v2` and no
 * `cie_gate`, even though /generate writes `cie_gate` unconditionally — a re-analysis had
 * overwritten score_data with a freshly built object.
 */
const PREVIOUS = {
  terms: [{ term: 'stary' }],
  words_target: 954,
  content_planner_v2: { bundle: { briefs: [] }, canWrite: true },
  knowledge_graph: { claims: [{ id: 'c1' }] },
  knowledge_coverage_report: { knowledgeCoveragePct: 100 },
  cie_gate: { use: true },
  cie_warning: 'knowledge_engine_fallback:below_floor',
  structural_benchmark: { h2: { median: 8 } },
};

describe('carriedScoreData', () => {
  it('carries the planner state a re-analysis cannot rebuild', () => {
    expect(carriedScoreData(PREVIOUS)).toEqual({
      content_planner_v2: PREVIOUS.content_planner_v2,
      knowledge_graph: PREVIOUS.knowledge_graph,
      knowledge_coverage_report: PREVIOUS.knowledge_coverage_report,
      cie_gate: PREVIOUS.cie_gate,
      cie_warning: PREVIOUS.cie_warning,
    });
  });

  it('drops the structural benchmark so the fresh corpus wins', () => {
    // Both planning routes prefer a stored benchmark over recomputing, so carrying one
    // over would let the previous competitor set define this run's structural targets.
    expect(carriedScoreData(PREVIOUS)).not.toHaveProperty('structural_benchmark');
  });

  it('never carries the fields the re-analysis rebuilds', () => {
    const carried = carriedScoreData(PREVIOUS);
    expect(carried).not.toHaveProperty('terms');
    expect(carried).not.toHaveProperty('words_target');
  });

  it('keeps an explicit null — "gate rejected it" is not "never computed"', () => {
    const carried = carriedScoreData({ knowledge_graph: null, cie_gate: { use: false } });
    expect(carried).toHaveProperty('knowledge_graph', null);
  });

  it.each([[null], [undefined], [{}]])('returns nothing for %p', (previous) => {
    expect(carriedScoreData(previous as Record<string, unknown> | null)).toEqual({});
  });

  it('lets the fresh analysis win when spread over the carry-over', () => {
    // The shape the route uses: { ...carried, ...scoreData }.
    const merged = { ...carriedScoreData(PREVIOUS), ...{ terms: [{ term: 'nowy' }], words_target: 1400 } };
    expect(merged.terms).toEqual([{ term: 'nowy' }]);
    expect(merged.words_target).toBe(1400);
    expect(merged.knowledge_graph).toEqual(PREVIOUS.knowledge_graph);
  });
});
