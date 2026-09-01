import type { CoverageItem } from '@/src/core/domain/coverage/aiCoverage';

/** The panel's post-generate poll must not settle on the deep-analysis snapshot. */
const shouldStopPolling = (
  items: CoverageItem[],
  status: string,
  hasScoreData: boolean,
): boolean => {
  const hasIntentRows = items.some((it) => it.category === 'intent' || it.type === 'intent');
  const finalizing = status === 'generating' || status === 'analyzing';
  return hasIntentRows || (!finalizing && (hasScoreData || items.length > 0));
};

const paaRow = (i: number) => ({ id: `paa-${i}`, type: 'paa', category: 'knowledge' } as CoverageItem);
const intentRow = { id: 'intent-answer-main', type: 'intent', category: 'intent' } as CoverageItem;

describe('post-generate coverage refresh', () => {
  it('keeps polling while only the deep-analysis PAA snapshot exists', () => {
    // Article 146: 27 PAA rows, no intent — the panel scored AI 36 against a database
    // that already held 73.
    const paaOnly = Array.from({ length: 27 }, (_, i) => paaRow(i));
    expect(shouldStopPolling(paaOnly, 'generating', true)).toBe(false);
  });

  it('stops once the post-generate snapshot carries intent rows', () => {
    expect(shouldStopPolling([...Array.from({ length: 27 }, (_, i) => paaRow(i)), intentRow], 'generating', true))
      .toBe(true);
  });

  it('still stops on a finished article that genuinely has no intent rows', () => {
    expect(shouldStopPolling([paaRow(0)], 'draft', true)).toBe(true);
  });
});
