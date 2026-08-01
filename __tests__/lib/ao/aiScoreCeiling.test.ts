import { computeCoverageScores, type CoverageItem } from '../../../lib/aiCoverage';
import { buildEditCandidates } from '../../../lib/ao/buildCandidates';
import { buildIntentProfile } from '../../../lib/ao/intentProfile';
import { ADEQUATE_QUALITY_MIN, AI_SCORE_QUALITY_TARGET } from '../../../lib/ao/coverageState';

const gi = (
  id: string,
  covered: boolean,
  quality: number,
  category: CoverageItem['category'] = 'knowledge',
): CoverageItem => ({
  id,
  label: id,
  type: 'paa',
  category,
  importance: 'recommended',
  source: 'paa',
  covered,
  quality,
});

describe('AI Search score ceiling vs Covered checklist', () => {
  it('all Covered at quality=3 caps overall near mid-50s (not ~85+)', () => {
    const items = [
      gi('q1', true, ADEQUATE_QUALITY_MIN, 'knowledge'),
      gi('q2', true, ADEQUATE_QUALITY_MIN, 'knowledge'),
      gi('q3', true, ADEQUATE_QUALITY_MIN, 'intent'),
      gi('q4', true, ADEQUATE_QUALITY_MIN, 'intent'),
    ];
    const { overall } = computeCoverageScores(items, false);
    // quality 3/5 × 85 blend ≈ 51
    expect(overall).toBeGreaterThanOrEqual(45);
    expect(overall).toBeLessThanOrEqual(60);
  });

  it('raising quality to 4+ lifts AI score toward 70+', () => {
    const items = [
      gi('q1', true, AI_SCORE_QUALITY_TARGET, 'knowledge'),
      gi('q2', true, AI_SCORE_QUALITY_TARGET, 'knowledge'),
      gi('q3', true, AI_SCORE_QUALITY_TARGET, 'intent'),
      gi('q4', true, AI_SCORE_QUALITY_TARGET, 'intent'),
    ];
    const { overall } = computeCoverageScores(items, false);
    expect(overall).toBeGreaterThanOrEqual(65);
  });

  it('when aiWeak, AO still candidates shallow Covered (quality 3) for deepen', () => {
    const profile = buildIntentProfile({
      keyword: 'cuckolding',
      plainText: 'Cuckolding to konsensualna praktyka.',
      headings: ['Definicja'],
    });
    const items = [
      gi('Czym jest cuckolding?', true, 3, 'knowledge'),
    ];
    items[0] = { ...items[0], label: 'Czym jest cuckolding?', type: 'paa' };

    const skipped = buildEditCandidates({
      profile,
      coverageItems: items,
      strategy: 'precision',
      seoStrong: true,
      aiWeak: false,
    });
    expect(skipped.some((c) => c.id.startsWith('cov-'))).toBe(false);

    const deepen = buildEditCandidates({
      profile,
      coverageItems: items,
      strategy: 'precision',
      seoStrong: true,
      aiWeak: true,
    });
    expect(deepen.some((c) => c.id.startsWith('cov-'))).toBe(true);
    expect(deepen.find((c) => c.id.startsWith('cov-'))?.suggestedAction).toBe('improve_direct_answer');
  });
});
