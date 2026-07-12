import {
  exclusiveVisibilityPercents,
  summarizeCumulativeBuckets,
  summarizeExclusiveBuckets,
} from '../../../lib/rankTracking/buckets';
import type { RankTrackingDeviceResult } from '../../../lib/types/rankTracking';

describe('rankTracking/buckets', () => {
  const dev = (position: number | null, previousPosition: number | null, found = position != null): RankTrackingDeviceResult => ({
    position,
    previousPosition,
    rankingUrl: null,
    rankingTitle: null,
    found,
    serpFeatures: [],
    hasSnapshot: true,
  });

  it('summarizeExclusiveBuckets uses mutually exclusive bands', () => {
    const counts = summarizeExclusiveBuckets([
      dev(2, 5),
      dev(8, 12),
      dev(15, 20),
      dev(null, 10, false),
    ]);
    expect(counts).toEqual({ top3: 1, top10: 1, top20: 1, notRanking: 1 });
    expect(exclusiveVisibilityPercents(counts, 4)).toEqual({
      top3: 25,
      top10: 50,
      top20: 75,
      notRanking: 25,
    });
  });

  it('summarizeCumulativeBuckets counts cumulative top-N with new/lost', () => {
    const { counts, newCounts, lostCounts } = summarizeCumulativeBuckets([
      dev(2, 10),
      dev(8, 5),
      dev(null, 3, false),
    ]);
    expect(counts.top3).toBe(1);
    expect(counts.top10).toBe(2);
    expect(newCounts.top3).toBe(1);
    expect(lostCounts.top3).toBe(1);
    expect(lostCounts.top10).toBe(1);
  });
});
