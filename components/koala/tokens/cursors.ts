/**
 * Koala UI v11 cursors — Figma `3950:57573` (macOS Cursor set).
 * Assets live in `/public/cursors/*.svg`. Hotspots are tip/center of each glyph.
 */

export type KoalaCursor =
  | 'default'
  | 'pointing'
  | 'dragging'
  | 'beachball'
  | 'busy'
  | 'copy'
  | 'cross'
  | 'help'
  | 'move'
  | 'resize-down'
  | 'resize-left'
  | 'resize-ew'
  | 'resize-right'
  | 'resize-up'
  | 'resize-ns'
  | 'text'
  | 'zoom-in'
  | 'zoom-out'
  | 'not-allowed';

type CursorDef = {
  file: string;
  /** CSS hotspot x y (pixels within the cursor image). */
  hotspot: [number, number];
  /** System cursor fallback. */
  fallback: string;
};

const BASE = '/cursors';

export const koalaCursors: Record<KoalaCursor, CursorDef> = {
  default: { file: `${BASE}/default.svg`, hotspot: [4, 2], fallback: 'auto' },
  pointing: { file: `${BASE}/pointing.svg`, hotspot: [8, 4], fallback: 'pointer' },
  dragging: { file: `${BASE}/dragging.svg`, hotspot: [10, 10], fallback: 'grab' },
  beachball: { file: `${BASE}/beachball.svg`, hotspot: [10, 10], fallback: 'wait' },
  busy: { file: `${BASE}/busy.svg`, hotspot: [4, 2], fallback: 'progress' },
  copy: { file: `${BASE}/copy.svg`, hotspot: [4, 2], fallback: 'copy' },
  cross: { file: `${BASE}/cross.svg`, hotspot: [8, 8], fallback: 'crosshair' },
  help: { file: `${BASE}/help.svg`, hotspot: [8, 8], fallback: 'help' },
  move: { file: `${BASE}/move.svg`, hotspot: [12, 12], fallback: 'move' },
  'resize-down': { file: `${BASE}/resize-down.svg`, hotspot: [8, 6], fallback: 's-resize' },
  'resize-left': { file: `${BASE}/resize-left.svg`, hotspot: [6, 8], fallback: 'w-resize' },
  'resize-ew': { file: `${BASE}/resize-ew.svg`, hotspot: [10, 8], fallback: 'ew-resize' },
  'resize-right': { file: `${BASE}/resize-right.svg`, hotspot: [6, 8], fallback: 'e-resize' },
  'resize-up': { file: `${BASE}/resize-up.svg`, hotspot: [8, 6], fallback: 'n-resize' },
  'resize-ns': { file: `${BASE}/resize-ns.svg`, hotspot: [8, 10], fallback: 'ns-resize' },
  text: { file: `${BASE}/text.svg`, hotspot: [6, 10], fallback: 'text' },
  'zoom-in': { file: `${BASE}/zoom-in.svg`, hotspot: [10, 10], fallback: 'zoom-in' },
  'zoom-out': { file: `${BASE}/zoom-out.svg`, hotspot: [10, 10], fallback: 'zoom-out' },
  'not-allowed': { file: `${BASE}/not-allowed.svg`, hotspot: [4, 2], fallback: 'not-allowed' },
};

/** CSS `cursor` value with custom asset + system fallback. */
export function cursorCss(name: KoalaCursor): string {
  const { file, hotspot, fallback } = koalaCursors[name];
  return `url("${file}") ${hotspot[0]} ${hotspot[1]}, ${fallback}`;
}
