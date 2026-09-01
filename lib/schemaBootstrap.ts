/**
 * One-shot schema bootstrap, run at process boot (instrumentation.ts) instead of
 * inside the first API request. Every ensure* below is idempotent and memoized in
 * its own module, so the per-route `await ensureX()` guards stay as free no-op
 * fallbacks — this just moves the ~200-statement DDL chain out of the request path.
 *
 * A failing step is logged and skipped: one broken subsystem must not take the
 * whole boot down, and the per-route guard retries it on first use anyway.
 */
import db from '../database/database';

let done: Promise<void> | null = null;

export function bootstrapSchema(): Promise<void> {
  if (!done) done = run();
  return done;
}

async function run(): Promise<void> {
  const t0 = Date.now();
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['sync', () => db.sync()],
    ['tenancy', async () => (await import('@/src/infrastructure/persistence/schema/ensureTenancyTables')).ensureTenancyTables()],
    ['appSettings', async () => (await import('@/src/infrastructure/stores/appSettingsStore')).ensureAppSettingsTable()],
    ['articles', async () => (await import('@/src/infrastructure/persistence/schema/ensureArticlesTables')).ensureArticlesTables()],
    ['pipeline', async () => (await import('@/src/infrastructure/persistence/schema/ensurePipelineTables')).ensurePipelineTables()],
    ['pipelineJobs', async () => (await import('@/src/infrastructure/persistence/schema/ensurePipelineJobsTables')).ensurePipelineJobsTables()],
    ['rankTracking', async () => (await import('@/src/infrastructure/persistence/schema/ensureRankTrackingTables')).ensureRankTrackingTables()],
    ['audit', async () => (await import('@/src/infrastructure/persistence/schema/ensureAuditTables')).ensureAuditTables()],
    ['keywordResearch', async () => (await import('@/src/infrastructure/persistence/schema/ensureKeywordResearchTables')).ensureKeywordResearchTables()],
    ['aiVisibility', async () => (await import('@/src/infrastructure/persistence/schema/ensureAiVisibilityTables')).ensureAiVisibilityTables()],
    ['competitors', async () => (await import('@/src/infrastructure/persistence/schema/ensureCompetitorsTables')).ensureCompetitorsTables()],
    ['corpus', async () => (await import('@/src/infrastructure/persistence/schema/ensureCorpusTables')).ensureCorpusTables()],
    ['ccm', async () => (await import('@/src/infrastructure/persistence/schema/ensureCcmTables')).ensureCcmTables()],
    ['embeddings', async () => (await import('@/src/infrastructure/semantic/embeddingStore')).ensureEmbeddingTables()],
    ['featureStore', async () => (await import('@/src/infrastructure/persistence/schema/ensureFeatureStoreTables')).ensureFeatureStoreTables()],
    ['growthMeta', async () => {
      const m = await import('@/src/infrastructure/persistence/schema/ensureGrowthMetaTables');
      await m.ensureDomainEventTables();
      await m.ensureKnowledgeLayerTables();
    }],
    ['calibration', async () => (await import('@/src/infrastructure/engines/calibrationStore')).ensureCalibrationTables()],
    ['gscData', async () => (await import('@/src/infrastructure/persistence/schema/ensureGscDataTable')).ensureGscDataTable()],
    ['gscSnapshots', async () => (await import('@/src/infrastructure/persistence/schema/ensureGscSnapshotTables')).ensureGscSnapshotTables()],
    ['automation', async () => (await import('@/src/infrastructure/persistence/schema/ensureAutomationTables')).ensureAutomationTables()],
    ['notifications', async () => (await import('@/src/infrastructure/persistence/schema/ensureNotificationTables')).ensureNotificationTables()],
    ['notificationEmail', async () => (await import('@/src/infrastructure/persistence/schema/ensureNotificationEmailTables')).ensureNotificationEmailTables()],
    ['emailConfirmations', async () => (await import('@/src/infrastructure/email/emailConfirmation')).ensureEmailConfirmationsTable()],
    ['billing', async () => (await import('@/src/infrastructure/persistence/schema/ensureBillingTables')).ensureBillingTables()],
    ['billingEmail', async () => (await import('@/src/infrastructure/persistence/schema/ensureBillingEmailTables')).ensureBillingEmailTables()],
    ['billingDomainEvents', async () => (await import('@/src/infrastructure/billing/domainEvents')).ensureBillingDomainEventsTable()],
    ['planQuota', async () => (await import('@/src/infrastructure/persistence/schema/ensurePlanQuotaTables')).ensurePlanQuotaTables()],
    ['aiTokenUsage', async () => (await import('@/src/infrastructure/ai/aiTokenUsage')).ensureAiTokenUsageTable()],
    ['wp', async () => (await import('@/src/infrastructure/persistence/schema/ensureWpTables')).ensureWpTables()],
  ];

  for (const [name, step] of steps) {
    try {
      await step();
    } catch (err) {
      console.error(`[schema-bootstrap] step "${name}" failed (route-level guard will retry):`, err);
    }
  }
  console.log(`[schema-bootstrap] done in ${Date.now() - t0}ms (${steps.length} steps)`);
}
