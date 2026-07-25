import {
  shouldOpenCustomContextMenu,
  menuAnchorPoint,
  clampMenuPosition,
  ranksmilePresetVoice,
} from '../../lib/ranksmileContextMenu';
import { getBlockFormatLabel } from '../../components/articles/RanksmileBubbleMenu';

describe('getBlockFormatLabel', () => {
  it('uses paragraph label when no heading is active', () => {
    expect(getBlockFormatLabel()).toBe('Aa');
  });

  it('uses the active heading level label', () => {
    expect(getBlockFormatLabel(1)).toBe('H1');
    expect(getBlockFormatLabel(4)).toBe('H4');
  });
});

describe('shouldOpenCustomContextMenu', () => {
  it('opens for non-empty selection without shift', () => {
    expect(shouldOpenCustomContextMenu({ shiftKey: false }, false)).toBe(true);
  });

  it('defers to native on shiftKey', () => {
    expect(shouldOpenCustomContextMenu({ shiftKey: true }, false)).toBe(false);
  });

  it('defers to native when selection is empty', () => {
    expect(shouldOpenCustomContextMenu({ shiftKey: false }, true)).toBe(false);
  });
});

describe('menuAnchorPoint', () => {
  it('uses pointer coords when non-zero', () => {
    expect(menuAnchorPoint({ clientX: 100, clientY: 200 }, () => ({ left: 1, bottom: 2 }), 10)).toEqual({
      x: 100,
      y: 200,
    });
  });

  it('uses selection coords when clientX/Y are 0 (keyboard)', () => {
    expect(
      menuAnchorPoint({ clientX: 0, clientY: 0 }, () => ({ left: 40, bottom: 80 }), 12),
    ).toEqual({ x: 40, y: 80 });
  });
});

describe('clampMenuPosition', () => {
  it('shifts left when overflowing the right edge', () => {
    const pos = clampMenuPosition(900, 10, 280, 100, 8, { innerWidth: 1000, innerHeight: 800 });
    expect(pos.left).toBe(1000 - 280 - 8);
    expect(pos.top).toBe(10);
  });

  it('shifts up when overflowing the bottom edge', () => {
    const pos = clampMenuPosition(10, 700, 200, 200, 8, { innerWidth: 1000, innerHeight: 800 });
    expect(pos.top).toBe(800 - 200 - 8);
  });
});

describe('ranksmilePresetVoice', () => {
  it('embeds the voice label', () => {
    expect(ranksmilePresetVoice('Casual')).toContain('Casual');
  });
});
