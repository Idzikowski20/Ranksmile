/**
 * WIE Explainability — III.10 decision log shape.
 */
import type { PolicyBundle, PolicyDecision, PolicyContext } from './policyResolver';

export type ExplainabilityRecord = {
  decision: string;
  principle_id?: string;
  confidence: number;
  effectiveness: number;
  source_layer: string;
  matched_conditions: {
    intent?: string;
    industry?: string;
    emotion?: string;
    content_shape?: string;
  };
  reason: string;
  dna_version: number;
  variant?: 'A' | 'B';
  pattern_id?: string;
};

export function decisionToExplainability(
  d: PolicyDecision,
  ctx: PolicyContext,
  variant?: 'A' | 'B',
): ExplainabilityRecord {
  return {
    decision: `${d.id}:${d.value}`,
    principle_id: d.principle_id,
    confidence: d.confidence,
    effectiveness: d.effectiveness,
    source_layer: d.source_layer,
    matched_conditions: {
      intent: ctx.searchIntent,
      industry: ctx.industry,
      emotion: ctx.emotion,
      content_shape: ctx.contentShape,
    },
    reason: d.reason,
    dna_version: d.dna_version,
    variant,
    pattern_id: d.pattern_id,
  };
}

export function bundleToExplainability(
  bundle: PolicyBundle | null | undefined,
  ctx: PolicyContext,
  variant?: 'A' | 'B',
): ExplainabilityRecord[] {
  if (!bundle?.decisions.length) return [];
  return bundle.decisions.map((d) => decisionToExplainability(d, ctx, variant));
}
