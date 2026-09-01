import type { AuditResult } from './types';

/**
 * On-page SEO score (0-100) from an audit's factor verdicts. Pure — reads the
 * AuditResult, penalises unlinked internal-link opportunities. No I/O.
 */
export function computeSeoScoreFromAudit(audit: AuditResult): number {
  const scored = audit.factors.filter((f) => f.verdict !== 'info');
  if (!scored.length) return audit.contentScore;
  let sum = 0;
  for (const f of scored) {
    if (f.verdict === 'ok') { sum += 1; continue; }
    const min = f.suggestedMin ?? 0;
    const max = f.suggestedMax ?? min;
    const span = Math.max(max - min, max * 0.2, 1);
    if (f.you < min) sum += Math.max(0, 1 - (min - f.you) / span);
    else if (f.you > max) sum += Math.max(0, 1 - (f.you - max) / span);
  }
  let base = Math.round((sum / scored.length) * 100);
  const missing = audit.internalLinks?.filter((l) => !l.linked).length ?? 0;
  if (missing > 0) {
    const penalty = Math.min(20, Math.round(Math.log10(missing + 1) * 8));
    base = Math.max(0, base - penalty);
  }
  return base;
}
