/**
 * Gap Engine — uncovered / shallow items → gaps with information-gain estimate.
 */
import type { CoverageItem, Importance } from '../aiCoverage';
import { countOccurrences } from '../termMatch';

export type CoverageGap = {
  itemId: string;
  label: string;
  type: string;
  importance: Importance;
  covered: boolean;
  quality: number;
  /** Estimated information gain if covered well (0–1). */
  informationGain: number;
  evidence: Array<{ kind: string; detail: string }>;
};

export type GapEngineResult = {
  gaps: CoverageGap[];
  coveredCount: number;
  totalCount: number;
  coverageRatio: number;
};

function igFor(item: CoverageItem): number {
  const imp =
    item.importance === 'critical' ? 1 : item.importance === 'recommended' ? 0.65 : 0.35;
  const conf = item.confidence ?? 0.5;
  const uncoveredBoost = item.covered ? Math.max(0, 1 - item.quality / 5) * 0.4 : 1;
  return Math.min(1, imp * conf * uncoveredBoost);
}

export function runGapEngine(opts: {
  items: readonly CoverageItem[];
  plainText?: string;
}): GapEngineResult {
  const plain = opts.plainText ?? '';
  const gaps: CoverageGap[] = [];
  let coveredCount = 0;

  for (const item of opts.items) {
    let covered = item.covered;
    let quality = item.quality;
    if (plain && (item.type === 'term' || item.type === 'concept' || item.type === 'entity')) {
      const hits = countOccurrences(plain, item.label);
      covered = hits >= 1;
      quality = hits >= 3 ? 4 : hits >= 1 ? 2 : 0;
    }
    if (covered && quality >= 2) coveredCount += 1;

    if (!covered || quality < 3) {
      gaps.push({
        itemId: item.id,
        label: item.label,
        type: item.type,
        importance: item.importance,
        covered,
        quality,
        informationGain: igFor({ ...item, covered, quality }),
        evidence: [
          {
            kind: covered ? 'shallow' : 'missing',
            detail: covered
              ? `Present but quality=${quality}/5`
              : `Not found in article text`,
          },
        ],
      });
    }
  }

  gaps.sort((a, b) => b.informationGain - a.informationGain);
  const totalCount = opts.items.length;
  return {
    gaps,
    coveredCount,
    totalCount,
    coverageRatio: totalCount ? coveredCount / totalCount : 0,
  };
}
