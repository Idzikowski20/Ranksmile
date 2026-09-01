import { computeSeoScoreFromAudit } from '../../../../../src/core/domain/audit/seoScore';
import type { AuditResult } from '../../../../../src/core/domain/audit/types';

function audit(over: Partial<AuditResult> = {}): AuditResult {
  return { contentScore: 42, factors: [], internalLinks: [], ...over } as AuditResult;
}

describe('computeSeoScoreFromAudit', () => {
  it('falls back to contentScore when no scored factors', () => {
    expect(computeSeoScoreFromAudit(audit({ factors: [{ verdict: 'info' } as never] }))).toBe(42);
  });

  it('scores an all-ok factor set at 100', () => {
    const a = audit({ factors: [{ verdict: 'ok' }, { verdict: 'ok' }] as never[] });
    expect(computeSeoScoreFromAudit(a)).toBe(100);
  });

  it('penalises unlinked internal-link opportunities', () => {
    const base = audit({ factors: [{ verdict: 'ok' }] as never[] });
    const withMissing = audit({
      factors: [{ verdict: 'ok' }] as never[],
      internalLinks: [{ linked: false }, { linked: false }] as never[],
    });
    expect(computeSeoScoreFromAudit(withMissing)).toBeLessThan(computeSeoScoreFromAudit(base));
  });
});
