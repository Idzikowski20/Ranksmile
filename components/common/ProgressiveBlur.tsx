import type { CSSProperties } from 'react';

type ProgressiveBlurProps = {
  /** Which scroll edge to fade. */
  position: 'top' | 'bottom';
  /** The background the content should fade INTO (usually the scroll container's bg). */
  backgroundColor?: string;
  /** Height of the fade band in px. ~72–96 reads well. */
  height?: number;
  /** backdrop-filter blur in px. Keep 3–6 — higher is costly, especially on mobile. */
  blurAmount?: number;
  style?: CSSProperties;
};

/**
 * ProgressiveBlur — a CSS-only progressive blur + colour fade at a scroll edge (à la Skiper41).
 * Purely decorative: absolutely positioned, `pointer-events: none`, so it never blocks the
 * content beneath it. Place inside a `position: relative` container that clips the scroll area.
 *
 * The blur is made *progressive* by masking the backdrop-filter so it's strongest at the very
 * edge and fades to nothing inward; a matching colour gradient dissolves the text into the bg.
 */
const ProgressiveBlur = ({
  position,
  backgroundColor = '#ffffff',
  height = 80,
  blurAmount = 4,
  style,
}: ProgressiveBlurProps) => {
  // 'to bottom' fades downward (top edge); 'to top' fades upward (bottom edge).
  const dir = position === 'top' ? 'to bottom' : 'to top';
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        ...(position === 'top' ? { top: 0 } : { bottom: 0 }),
        height,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 3,
        background: `linear-gradient(${dir}, ${backgroundColor}, transparent)`,
        WebkitMaskImage: `linear-gradient(${dir}, #000 0%, transparent 100%)`,
        maskImage: `linear-gradient(${dir}, #000 0%, transparent 100%)`,
        WebkitBackdropFilter: `blur(${blurAmount}px)`,
        backdropFilter: `blur(${blurAmount}px)`,
        ...style,
      }}
    />
  );
};

export default ProgressiveBlur;
