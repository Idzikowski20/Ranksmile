/**
 * Planner zone — ActionGraph builder + stateless planner.
 */
export {
  buildActionGraph,
  countEvidenceSpans,
  type BuildActionGraphOpts,
} from '@/src/core/planner/actionGraphBuilder';
export {
  planActions,
  plannerConsumer,
  type EditPlan,
  type PlannerStrategy,
} from '@/src/core/planner/planActions';
