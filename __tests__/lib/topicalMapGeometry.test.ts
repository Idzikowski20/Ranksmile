import { ringRadius, nodeCenter, MAP_RING_COUNT, MAP_CENTER, MAP_NODE_RANGE } from '../../lib/topicalMapGeometry';

describe('topicalMapGeometry', () => {
  it('computes ring radii stepping 44.44 up to the reference max (355.55)', () => {
    expect(ringRadius(0)).toBeCloseTo(44.44, 1);
    expect(ringRadius(MAP_RING_COUNT - 1)).toBeCloseTo(355.55, 1);
  });

  it('maps the normalized center (0,0) to the SVG center', () => {
    expect(nodeCenter(0, 0)).toEqual({ cx: MAP_CENTER.x, cy: MAP_CENTER.y });
  });

  it('scales normalized x/y by MAP_NODE_RANGE around the center', () => {
    const { cx, cy } = nodeCenter(1, -1);
    expect(cx).toBe(MAP_CENTER.x + MAP_NODE_RANGE);
    expect(cy).toBe(MAP_CENTER.y - MAP_NODE_RANGE);
  });
});
