import { PLANNER_VERSION } from './contentPlanner/types';

/** Bump when the planner or writer changes in a way that should be measurable later. */
export const PIPELINE_VERSION = `planner-${PLANNER_VERSION}`;

export function pipelineVersionTag(opts: { manualOutline: boolean }): string {
  return opts.manualOutline ? `${PIPELINE_VERSION}+manual-outline` : PIPELINE_VERSION;
}
