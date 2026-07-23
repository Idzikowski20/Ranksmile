/**
 * Calibration — Feature Store vectors only (no LLM ranking).
 * Fits simple linear weights from historical score vs outcomes.
 */
import type { Feature } from '../primitives/types';

export type CalibrationSample = {
  featureVector: number[];
  /** Observed outcome 0–100 (ranking / citation / score). */
  outcome: number;
};

export type CalibrationModel = {
  weights: number[];
  bias: number;
  samples: number;
  version: number;
};

export function extractFeatureVector(f: Feature): number[] {
  const score = f.score.value ?? f.score.score;
  const signalNums = f.signals
    .map((s) => (typeof s.value === 'number' ? s.value : 0))
    .slice(0, 8);
  while (signalNums.length < 8) signalNums.push(0);
  return [score, f.confidence, ...signalNums];
}

/** One-pass OLS-ish ridge for small N — backend calibration stub. */
export function fitCalibration(samples: CalibrationSample[]): CalibrationModel {
  if (!samples.length) {
    return { weights: [], bias: 50, samples: 0, version: 1 };
  }
  const dim = samples[0].featureVector.length;
  // Normalize features to ~0-1 for stable gradient steps
  const maxes = new Array(dim).fill(1);
  for (const s of samples) {
    for (let i = 0; i < dim; i++) {
      maxes[i] = Math.max(maxes[i], Math.abs(s.featureVector[i] ?? 0));
    }
  }
  const norm = (v: number[]) => v.map((x, i) => x / maxes[i]);

  const weights = new Array(dim).fill(0);
  let bias = samples.reduce((s, x) => s + x.outcome, 0) / samples.length;
  const lr = 0.05;
  const epochs = 80;
  for (let e = 0; e < epochs; e++) {
    for (const s of samples) {
      const fv = norm(s.featureVector);
      let pred = bias;
      for (let i = 0; i < dim; i++) pred += weights[i] * (fv[i] ?? 0);
      const err = s.outcome - pred;
      bias += lr * err;
      for (let i = 0; i < dim; i++) {
        weights[i] += lr * err * (fv[i] ?? 0) - lr * 0.001 * weights[i];
      }
    }
  }
  // Store weights in original scale: w_i / max_i
  const scaled = weights.map((w, i) => w / maxes[i]);
  // Postgres INTEGER max ~2.1e9 — Date.now() overflows; use unix seconds.
  return { weights: scaled, bias, samples: samples.length, version: Math.floor(Date.now() / 1000) };
}

export function predictCalibrated(model: CalibrationModel, vector: number[]): number {
  if (!model.weights.length) return 50;
  let pred = model.bias;
  for (let i = 0; i < model.weights.length; i++) {
    pred += model.weights[i] * (vector[i] ?? 0);
  }
  return Math.max(0, Math.min(100, Math.round(pred)));
}

export function calibrateFromFeatures(features: Feature[], outcomes: number[]): CalibrationModel {
  const samples: CalibrationSample[] = features.map((f, i) => ({
    featureVector: extractFeatureVector(f),
    outcome: outcomes[i] ?? (f.score.value ?? f.score.score),
  }));
  return fitCalibration(samples);
}

/** Fit + persist for a workspace (async). */
export async function calibrateAndPersist(
  workspaceId: string,
  features: Feature[],
  outcomes: number[],
): Promise<CalibrationModel> {
  const model = calibrateFromFeatures(features, outcomes);
  const { saveCalibrationModel } = await import('./calibrationStore');
  await saveCalibrationModel(workspaceId, model);
  return model;
}
