import { buildSeriesYScale } from '../../../components/koala/charts/yScale';

describe('independent Y scales (GSC-style)', () => {
  it('maps low clicks near mid/top of chart even when impressions are huge', () => {
    const H = 200;
    const clicks = buildSeriesYScale([10, 50, 80], H, { reverse: false, zeroBaseline: true });
    const impressions = buildSeriesYScale([6000, 8000, 7500], H, { reverse: false, zeroBaseline: true });

    // Shared-scale would put clicks≈50 at y≈H*(1-50/8000)≈199 (floor).
    expect(clicks(80)).toBeLessThan(H * 0.25);
    expect(impressions(8000)).toBeLessThan(H * 0.25);
    expect(Math.abs(clicks(80) - impressions(8000))).toBeLessThan(8);
  });

  it('reverses rank so lower position is higher on chart', () => {
    const H = 200;
    const rank = buildSeriesYScale([5, 20, 10], H, { reverse: true, zeroBaseline: false });
    expect(rank(5)).toBeLessThan(rank(20));
  });
});
