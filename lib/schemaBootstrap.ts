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
    ['tenancy', async () => (await import('./ensureTenancyTables')).ensureTenancyTables()],
    ['appSettings', async () => (await import('./appSettingsStore')).ensureAppSettingsTable()],
    ['articles', async () => (await import('./ensureArticlesTables')).ensureArticlesTables()],
    ['pipeline', async () => (await import('./ensurePipelineTables')).ensurePipelineTables()],
    ['pipelineJobs', async () => (await import('./ensurePipelineJobsTables')).ensurePipelineJobsTables()],
    ['rankTracking', async () => (await import('./ensureRankTrackingTables')).ensureRankTrackingTables()],
    ['audit', async () => (await import('./ensureAuditTables')).ensureAuditTables()],
    ['keywordResearch', async () => (await import('./ensureKeywordResearchTables')).ensureKeywordResearchTables()],
    ['aiVisibility', async () => (await import('./ensureAiVisibilityTables')).ensureAiVisibilityTables()],
    ['competitors', async () => (await import('./ensureCompetitorsTables')).ensureCompetitorsTables()],
    ['corpus', async () => (await import('./ensureCorpusTables')).ensureCorpusTables()],
    ['ccm', async () => (await import('./ensureCcmTables')).ensureCcmTables()],
    ['embeddings', async () => (await import('./semantic/embeddingStore')).ensureEmbeddingTables()],
    ['featureStore', async () => (await import('./ensureFeatureStoreTables')).ensureFeatureStoreTables()],
    ['growthMeta', async () => {
      const m = await import('./ensureGrowthMetaTables');
      await m.ensureDomainEventTables();
      await m.ensureKnowledgeLayerTables();
    }],
    ['calibration', async () => (await import('./engines/calibrationStore')).ensureCalibrationTables()],
    ['gscData', async () => (await import('./ensureGscDataTable')).ensureGscDataTable()],
    ['gscSnapshots', async () => (await import('./ensureGscSnapshotTables')).ensureGscSnapshotTables()],
    ['automation', async () => (await import('./ensureAutomationTables')).ensureAutomationTables()],
    ['notifications', async () => (await import('./ensureNotificationTables')).ensureNotificationTables()],
    ['notificationEmail', async () => (await import('./ensureNotificationEmailTables')).ensureNotificationEmailTables()],
    ['emailConfirmations', async () => (await import('./emailConfirmation')).ensureEmailConfirmationsTable()],
    ['billing', async () => (await import('./ensureBillingTables')).ensureBillingTables()],
    ['billingEmail', async () => (await import('./ensureBillingEmailTables')).ensureBillingEmailTables()],
    ['billingDomainEvents', async () => (await import('./billing/domainEvents')).ensureBillingDomainEventsTable()],
    ['planQuota', async () => (await import('./ensurePlanQuotaTables')).ensurePlanQuotaTables()],
    ['aiTokenUsage', async () => (await import('./aiTokenUsage')).ensureAiTokenUsageTable()],
    ['wp', async () => (await import('./ensureWpTables')).ensureWpTables()],
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
