import type { PipelineWorker } from './types';
import { serpWorker } from './serp';
import { coverageWorker } from './coverage';
import { liveScoreWorker } from './live_score';
import { nerWorker } from './ner';
import { fingerprintWorker } from './fingerprint';
import { tfidfWorker } from './tfidf';
import { plannerWorker } from './planner';
import { visibilityWorker } from './visibility';
import { geoWorker } from './geo';
import { diffWorker } from './diff';
import { embeddingsWorker } from './embeddings';
import {
  getPipelineStage,
  isWorkerAllowedAtStage,
  type PipelineStageId,
} from '../pipeline/pipelineStage';

const registry = new Map<string, PipelineWorker>();
let seededForStage: PipelineStageId | null = null;

/** All worker modules (on disk). Only stage-allowed ones are seeded into the registry. */
const ALL_WORKER_MODULES: PipelineWorker[] = [
  serpWorker,
  coverageWorker,
  liveScoreWorker,
  nerWorker,
  fingerprintWorker,
  tfidfWorker,
  plannerWorker,
  visibilityWorker,
  geoWorker,
  diffWorker,
  embeddingsWorker,
];

function seed(): void {
  const stage = getPipelineStage();
  if (seededForStage === stage && registry.size) return;
  registry.clear();
  for (const w of ALL_WORKER_MODULES) {
    if (!isWorkerAllowedAtStage(w.id, stage)) continue;
    registry.set(w.id, w);
    registry.set(w.queue, w);
  }
  seededForStage = stage;
}

/** Reset registry (tests / stage change mid-process). */
export function resetWorkerRegistry(): void {
  registry.clear();
  seededForStage = null;
}

export function registerWorker(worker: PipelineWorker): void {
  seed();
  if (!isWorkerAllowedAtStage(worker.id)) {
    throw new Error(
      `Worker "${worker.id}" requires higher PIPELINE_STAGE (current=${getPipelineStage()})`,
    );
  }
  registry.set(worker.id, worker);
  registry.set(worker.queue, worker);
}

export function getWorker(idOrQueue: string): PipelineWorker | undefined {
  seed();
  return registry.get(idOrQueue);
}

export function listWorkers(): PipelineWorker[] {
  seed();
  const seen = new Set<string>();
  const out: PipelineWorker[] = [];
  for (const w of registry.values()) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    out.push(w);
  }
  return out;
}

export function isQueueEnabled(queueOrId: string): boolean {
  return !!getWorker(queueOrId);
}
