import { getBlockFormatLabel, getBubbleMenuPosition } from '../../components/articles/SurfyBubbleMenu';

describe('getBubbleMenuPosition', () => {
  const base = {
    menuWidth: 370,
    menuHeight: 40,
    menuGap: 8,
    viewportWidth: 900,
    viewportHeight: 600,
    offsetParentRect: { left: 50, top: 80 },
  };

  it('keeps the menu inside the left edge of the viewport', () => {
    const position = getBubbleMenuPosition({
      ...base,
      cursorRect: { left: 70, right: 70, top: 200, bottom: 220 },
    });

    expect(position.left).toBe(8 - base.offsetParentRect.left);
    expect(position.top).toBe(200 - base.menuHeight - base.menuGap - base.offsetParentRect.top);
  });

  it('keeps the menu inside the right edge of the viewport', () => {
    const position = getBubbleMenuPosition({
      ...base,
      cursorRect: { left: 860, right: 860, top: 200, bottom: 220 },
    });

    expect(position.left).toBe(900 - 370 - 8 - base.offsetParentRect.left);
  });

  it('places the menu below the cursor when there is no room above', () => {
    const position = getBubbleMenuPosition({
      ...base,
      cursorRect: { left: 450, right: 450, top: 40, bottom: 60 },
    });

    expect(position.top).toBe(60 + base.menuGap - base.offsetParentRect.top);
  });

  it('keeps the menu inside the editor boundary when the cursor is close to its left edge', () => {
    const position = getBubbleMenuPosition({
      ...base,
      cursorRect: { left: 120, right: 120, top: 200, bottom: 220 },
      boundaryRect: { left: 80, right: 900, top: 0, bottom: 600 },
    });

    expect(position.left).toBe(80 - base.offsetParentRect.left);
  });
});

describe('getBlockFormatLabel', () => {
  it('uses paragraph label when no heading is active', () => {
    expect(getBlockFormatLabel()).toBe('Aa');
  });

  it('uses the active heading level label', () => {
    expect(getBlockFormatLabel(1)).toBe('H1');
    expect(getBlockFormatLabel(4)).toBe('H4');
  });
});
