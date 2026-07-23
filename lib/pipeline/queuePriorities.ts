/** Numeric BullMQ priorities — higher = processed first.
 * Stack: Redis + BullMQ only. No Kafka / Temporal / RabbitMQ / Celery.
 *
 * Workers process: REDIS_URL=… PIPELINE_STAGE=2 npx tsx scripts/pipeline-workers.ts
 * Next.js: set PIPELINE_INLINE_WORKERS=0 when using the workers process.
 */

export const QUEUE_PRIORITY = {
  live_score: 1000,
  planner: 700,
  coverage: 600,
  serp_crawl: 500,
  deep_analysis: 500,
  ner: 450,
  fingerprint: 450,
  tfidf: 450,
  diff: 400,
  geo: 400,
  visibility: 400,
  maintenance: 300,
  embeddings: 100,
} as const;

export type QueueName = keyof typeof QUEUE_PRIORITY;

export const PIPELINE_VERSION = 'v7.0.0';

export const QUEUE_NAMES = Object.keys(QUEUE_PRIORITY) as QueueName[];
