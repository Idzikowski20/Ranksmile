/**
 * score_data keys deep-analysis must carry across a re-analysis.
 *
 * That route writes `score_data = ?` with a freshly built object, so everything it does
 * not rebuild is destroyed. Re-running an analysis after a generation wiped the Knowledge
 * Graph and the persisted planner bundle — and nothing rebuilds those on the outline path,
 * because `runKnowledgeEngine` only runs inside /generate. The review screen then fell
 * back to a competitor-heading skeleton and the developer report showed
 * `knowledge_graph: null` for an article that had one.
 *
 * Lives in lib/ rather than beside the route so it can be unit-tested: importing the route
 * pulls in sequelize, which fails at module load under Jest.
 */
export const CARRIED_SCORE_DATA_KEYS = [
  'content_planner_v2',
  'knowledge_graph',
  'knowledge_coverage_report',
  'cie_gate',
  'cie_warning',
] as const;

/**
 * The subset of a previous `score_data` that survives a re-analysis.
 *
 * `structural_benchmark` is deliberately absent: both planning routes recompute it from
 * the competitor rows this run just refreshed, and they prefer a stored copy
 * (`storedBenchmark || buildStructuralBenchmark(...)`) — carrying one over would let stale
 * structural targets beat the fresh corpus.
 */
export function carriedScoreData(
  previous: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!previous) return {};
  const carried: Record<string, unknown> = {};
  for (const key of CARRIED_SCORE_DATA_KEYS) {
    // `null` is meaningful — /generate writes `knowledge_graph: null` when the gate
    // rejected the graph, and dropping that would read as "never computed".
    if (previous[key] !== undefined) carried[key] = previous[key];
  }
  return carried;
}
