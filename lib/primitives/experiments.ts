import type { ExperimentRef, PipelineVersions } from './types';

/** Simple stable hash → [0, 1). */
export function stableUnitInterval(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export type ExperimentDefinition = {
  id: string;
  /** Variant labels; equal weight unless weights provided. */
  variants: string[];
  weights?: number[];
};

/**
 * Assign a stable experiment bucket for a subject (articleId / domainId / userId).
 * Same subjectKey → same variant forever for a given experiment id.
 */
export function assignExperimentBucket(
  experiment: ExperimentDefinition,
  subjectKey: string,
): ExperimentRef {
  const variants = experiment.variants.length ? experiment.variants : ['control'];
  const weights =
    experiment.weights && experiment.weights.length === variants.length
      ? experiment.weights
      : variants.map(() => 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const r = stableUnitInterval(`${experiment.id}::${subjectKey}`);
  let acc = 0;
  let chosen = variants[variants.length - 1]!;
  for (let i = 0; i < variants.length; i += 1) {
    acc += weights[i]! / total;
    if (r < acc) {
      chosen = variants[i]!;
      break;
    }
  }
  const bucketPct = Math.floor(r * 100);
  return {
    id: experiment.id,
    variant: chosen,
    bucket: String(bucketPct),
  };
}

export function withExperiment(
  versions: PipelineVersions,
  experiment: ExperimentRef,
): PipelineVersions {
  return {
    ...versions,
    experimentId: experiment.id,
    experimentVariant: experiment.variant,
    experimentBucket: experiment.bucket,
  };
}

/** Built-in coverage scoring A/B. */
export const COVERAGE_EXPERIMENT: ExperimentDefinition = {
  id: 'coverage-scoring',
  variants: ['coverage-v2', 'coverage-v3'],
  weights: [50, 50],
};
