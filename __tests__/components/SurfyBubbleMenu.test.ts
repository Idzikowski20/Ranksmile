import { getBlockFormatLabel } from '../../components/articles/SurfyBubbleMenu';

describe('getBlockFormatLabel', () => {
  it('uses paragraph label when no heading is active', () => {
    expect(getBlockFormatLabel()).toBe('Aa');
  });

  it('uses the active heading level label', () => {
    expect(getBlockFormatLabel(1)).toBe('H1');
    expect(getBlockFormatLabel(4)).toBe('H4');
  });
});
