import { crossedAngle } from '../../components/aiTracking/useRadarMotion';

describe('crossedAngle (radar sweep threshold)', () => {
  it('fires when the sweep passes the angle moving right', () => {
    expect(crossedAngle(-5, 5, 0)).toBe(true);
    expect(crossedAngle(1, 5, 0)).toBe(false);
  });

  it('fires when the sweep passes the angle moving left (yoyo return)', () => {
    expect(crossedAngle(5, -5, 0)).toBe(true);
    expect(crossedAngle(-1, -5, 0)).toBe(false);
  });

  it('fires when a frame lands exactly on the angle, once per crossing', () => {
    expect(crossedAngle(-5, 0, 0)).toBe(true);
    // already past it — no re-fire while staying on the far side
    expect(crossedAngle(0, 3, 0)).toBe(false);
  });
});
