/**
 * Pure learning loop — calibration feedback + corpus-diff planner signals (no DB).
 */
import type { Feature } from '../primitives/types';
import {
  calibrateFromFeatures,
  extractFeatureVector,
  predictCalibrated,
  type CalibrationModel,
} from '../engines/calibration';
import type { PlannerSignal } from '../engines/corpusDiff';

export type LearningUpdate = {
  calibration: CalibrationModel;
  plannerHints: string[];
};

/**
 * Combine feature outcomes + diff signals into updated calibration + planner hints.
 */
export function runLearningLoop(opts: {
  features: Feature[];
  outcomes: number[];
  diffSignals?: PlannerSignal[];
}): LearningUpdate {
  const calibration = calibrateFromFeatures(opts.features, opts.outcomes);
  const plannerHints: string[] = [];
  for (const s of opts.diffSignals ?? []) {
    if (s.severity === 'high') {
      plannerHints.push(`Re-plan: ${s.detail}`);
    }
  }
  if (opts.features.length && opts.outcomes.length) {
    const last = opts.features[opts.features.length - 1];
    const pred = predictCalibrated(calibration, extractFeatureVector(last));
    const actual = opts.outcomes[opts.outcomes.length - 1];
    if (Math.abs(pred - actual) > 15) {
      plannerHints.push(
        `Calibration drift: predicted ${pred}, observed ${actual} — prefer cheaper coverage actions`,
      );
    }
  }
  return { calibration, plannerHints };
}
