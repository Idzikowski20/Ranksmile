/**
 * Projections zone — read CCM → views. No HTML / coverageEngine as SoT.
 */
export { projectCoverage, type CoverageView } from './coverageView';
export {
  projectVisibility,
  type VisibilityProjection,
  type VisibilityCluster,
} from './visibilityView';
