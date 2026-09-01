/**
 * Projections zone — read CCM → views. No HTML / coverageEngine as SoT.
 */
export { projectCoverage, type CoverageView } from '@/src/core/projections/coverageView';
export {
  projectVisibility,
  type VisibilityProjection,
  type VisibilityCluster,
} from '@/src/core/projections/visibilityView';
