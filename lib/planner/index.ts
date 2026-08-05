/**
 * Planner zone — ActionGraph builder + stateless planner.
 */
export {
  buildActionGraph,
  countEvidenceSpans,
  type BuildActionGraphOpts,
} from './actionGraphBuilder';
export {
  planActions,
  plannerConsumer,
  type EditPlan,
  type PlannerStrategy,
} from './planActions';
