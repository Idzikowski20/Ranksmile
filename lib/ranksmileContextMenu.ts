/** Pure helpers for the Ranksmile editor right-click context menu. */

export function shouldOpenCustomContextMenu(
  e: { shiftKey: boolean },
  empty: boolean,
): boolean {
  if (e.shiftKey) return false;
  if (empty) return false;
  return true;
}

export function menuAnchorPoint(
  e: { clientX: number; clientY: number },
  coordsAtPos: (pos: number) => { left: number; bottom: number },
  selectionTo: number,
): { x: number; y: number } {
  if (e.clientX === 0 && e.clientY === 0) {
    const c = coordsAtPos(selectionTo);
    return { x: c.left, y: c.bottom };
  }
  return { x: e.clientX, y: e.clientY };
}

export function clampMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  pad = 8,
  viewport: { innerWidth: number; innerHeight: number } = typeof window !== 'undefined'
    ? window
    : { innerWidth: 1280, innerHeight: 720 },
): { left: number; top: number } {
  let left = x;
  let top = y;
  if (left + width > viewport.innerWidth - pad) {
    left = Math.max(pad, viewport.innerWidth - width - pad);
  }
  if (top + height > viewport.innerHeight - pad) {
    top = Math.max(pad, viewport.innerHeight - height - pad);
  }
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  return { left, top };
}

export const RANKSMILE_PRESET_IMPROVE =
  'Improve the writing of the selected text. Keep meaning and SEO terms.';
export const RANKSMILE_PRESET_EXPAND =
  'Expand the selected text with useful detail. Keep tone and SEO terms.';

export function ranksmilePresetVoice(voice: string): string {
  return `Rewrite the selected text in a ${voice} voice. Keep meaning.`;
}

export const RANKSMILE_VOICE_OPTIONS = ['Professional', 'Casual', 'Friendly'] as const;
