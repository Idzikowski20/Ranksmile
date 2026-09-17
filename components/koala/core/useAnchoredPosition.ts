import { useEffect, useState, type CSSProperties, type RefObject } from 'react';

/**
 * Fixed-position style for a floating menu anchored to `anchor`, for menus portalled to
 * <body> so an `overflow` ancestor (a modal body, a scroll panel) can't clip them. Opens
 * below the anchor and flips above only when a menu of `menuHeight` px doesn't fit below
 * but has more room above. Tracks scroll (any ancestor) and resize while open; null while closed.
 */
export function useAnchoredPosition(
  anchor: RefObject<HTMLElement>,
  open: boolean,
  menuHeight = 260,
): CSSProperties | null {
  const [pos, setPos] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 8;
      const up = below < menuHeight && r.top > below;
      const next: CSSProperties = up
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 }
        : { left: r.left, width: r.width, top: r.bottom + 4 };
      // Keep the same object when nothing moved, so scroll ticks don't re-render.
      setPos((prev) => (prev && prev.left === next.left && prev.width === next.width
        && prev.top === next.top && prev.bottom === next.bottom ? prev : next));
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchor, menuHeight]);

  return pos;
}

/** z-index for portalled menus: above the modal overlay (10000). */
export const FLOATING_MENU_Z = 10050;
