/**
 * Thin Feature Store wiring stub for Etap 0.5 — serp/coverage/fingerprint producers.
 */
import type { Feature, ScoreVector, Signal } from '../primitives/types';
import { getFeatureStore } from '../featureStore';
import type { FingerprintMetrics } from '../corpus/corpusService';

export async function wireFingerprintFeatures(opts: {
  workspaceId: string;
  keyword: string;
  corpusVersion?: number;
  metrics: FingerprintMetrics;
  articleId?: number;
  domainId?: number;
}): Promise<Feature> {
  const m = opts.metrics;
  const signals: Signal[] = [
    { id: 'h2_avg', key: 'h2_avg', value: m.h2Avg },
    { id: 'faq_rate', key: 'faq_rate', value: m.faqRate },
    { id: 'schema_rate', key: 'schema_rate', value: m.schemaRate },
    { id: 'entity_count', key: 'entity_count', value: m.entityCount },
    { id: 'concept_count', key: 'concept_count', value: m.conceptCount },
  ];
  const scoreVal = Math.min(
    100,
    Math.round(
      m.faqRate * 20 + m.schemaRate * 20 + Math.min(m.h2Avg, 8) * 5 + Math.min(m.entityCount, 20),
    ),
  );
  const score: ScoreVector = {
    score: scoreVal,
    confidence: 0.65,
    version: 1,
    contributors: [{ id: 'fingerprint', label: 'SERP fingerprint', delta: scoreVal }],
  };
  const feature: Feature = {
    id: `fingerprint:${opts.workspaceId}:${opts.keyword}`,
    // growth_feature_versions.version is INT4 — Date.now() ms overflows → DLQ "integer out of range"
    version: Math.floor(Date.now() / 1000),
    createdAt: new Date().toISOString(),
    snapshotId: opts.corpusVersion != null ? String(opts.corpusVersion) : undefined,
    score,
    confidence: 0.65,
    signals,
    actions: [],
  };
  await getFeatureStore().appendFeature(feature, {
    articleId: opts.articleId,
    domainId: opts.domainId,
  });
  return feature;
}
