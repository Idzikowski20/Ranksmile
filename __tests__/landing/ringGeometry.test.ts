import { ringGeometry } from '../../components/landing/sections/ringGeometry';

describe('ringGeometry', () => {
  it('derives radius and circumference from size and stroke', () => {
    const { r, c } = ringGeometry(50, 68.58, 6);
    expect(r).toBeCloseTo(31.29, 2);
    expect(c).toBeCloseTo(2 * Math.PI * 31.29, 2);
  });

  it('leaves the full circumference unpainted at 0 and none at 100', () => {
    const { c, offset: empty } = ringGeometry(0, 130.63, 8);
    const { offset: full } = ringGeometry(100, 130.63, 8);
    expect(empty).toBeCloseTo(c, 6);
    expect(full).toBeCloseTo(0, 6);
  });

  it('paints value% of the circumference (offset shrinks linearly with value)', () => {
    const { c, offset } = ringGeometry(75, 130.63, 8);
    expect(offset).toBeCloseTo(c * 0.25, 6);
  });
});
