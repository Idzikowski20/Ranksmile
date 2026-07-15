import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
import { scoreColor } from '../../lib/scoreColor';

interface Props {
  score: number;
  compact?: boolean;
  size?: number;
  pending?: boolean;
  /** Green "↑N" increase badge (vs a baseline) shown during/after Auto-Optimize. */
  delta?: number;
  /** Where the delta badge sits relative to the gauge. */
  deltaPlacement?: 'right' | 'left' | 'below';
}

// Split dual-arc gauge (left + right half), each with a grey track and a coloured
// fill, plus 6 outer tick marks. Geometry copied verbatim from the reference SVG.
const ARC = 111.70107212763709; // arc length of each half
const LEFT = 'M 43.05407289332279,89.39231012048832 A 40,40 0 0,1 43.05407289332279,10.607689879511682';
const RIGHT = 'M 56.94592710667722,89.39231012048832 A 40,40 0 0,0 56.94592710667722,10.607689879511682';
const TICKS = [
  'M 13,50 L 7,50',
  'M 20.507288939919352,74.74732297293177 L 18.209155610562416,76.67568580199139',
  'M 17.350148297977597,29.598108327021617 L 14.806004009508321,28.008350534322002',
  'M 87,50 L 93,50',
  'M 79.49271106008065,74.74732297293176 L 81.79084438943758,76.67568580199138',
  'M 82.6498517020224,29.59810832702161 L 85.19399599049169,28.008350534322',
];

const UpArrow = () => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-0.12em' }}>
    <path fill="currentColor" fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17" clipRule="evenodd" />
  </svg>
);

const DeltaBadge = ({ delta, placement }: { delta: number; placement: 'right' | 'left' | 'below' }) => {
  const base: React.CSSProperties = {
    position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: 2,
    color: '#1AB25E', fontSize: 13, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-family-primary)', pointerEvents: 'none',
  };
  const pos: React.CSSProperties = placement === 'right'
    ? { left: 'calc(100% + 4px)', top: '50%', transform: 'translateY(-50%)' }
    : placement === 'left'
      ? { right: 'calc(100% + 4px)', top: '50%', transform: 'translateY(-50%)' }
      : { left: '30%', top: '60%', transform: 'translateX(-50%)' };
  const reduced = useReducedMotion();
  return (
    <motion.span initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.25 }} style={{ ...base, ...pos }}>
      <UpArrow />{delta}
    </motion.span>
  );
};

/** Count-up number (Surfer number-flow style) — animates from the previous value
 *  to the new one, rounding on each frame. Used for the large central gauge. */
const CountUpNumber = ({ value, font }: { value: number; font: number }) => {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (reduced) { setDisplay(value); prev.current = value; return undefined; }
    const controls = animate(prev.current, value, {
      duration: 0.6,
      ease: [0.34, 2, 0.64, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduced]);
  return (
    <span style={{ fontFamily: 'var(--font-family-primary)', fontWeight: 700, fontSize: font, color: '#18181B', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
      {display}
    </span>
  );
};

const ScoreGauge = ({ score, compact, size: sizeProp, pending, delta, deltaPlacement = 'below' }: Props) => {
  const reduced = useReducedMotion();
  const s = Math.max(0, Math.min(100, Math.round(score || 0)));
  const color = scoreColor(s);
  // No data yet → grey track only, no coloured fill, "—" in the centre.
  const offset = pending ? ARC : ARC * (1 - s / 100);
  const size = sizeProp ?? (compact ? 56 : 96);
  const numberFont = size <= 64 ? 16 : 24;
  const fillStyle: React.CSSProperties = {
    transition: reduced ? 'none' : 'stroke 400ms ease-in-out, stroke-dashoffset 600ms cubic-bezier(0.34,2,0.64,1)',
  };

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <g>
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={LEFT} stroke="#E4E4E7" strokeDasharray="111.70107212763709 9999" opacity={0.5} />
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={LEFT} stroke={color} strokeDasharray="111.70107212763709 9999" strokeDashoffset={offset} style={fillStyle} />
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={RIGHT} stroke="#E4E4E7" strokeDasharray="111.70107212763709 9999" opacity={0.5} />
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={RIGHT} stroke={color} strokeDasharray="111.70107212763709 9999" strokeDashoffset={offset} style={fillStyle} />
        </g>
        {TICKS.map((d) => (
          <path key={d} d={d} stroke="black" strokeOpacity={0.3} strokeWidth={1.5} strokeLinecap="butt" />
        ))}
      </svg>

      {/* Odometer number — the new value rolls in from below when the score changes. */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {pending ? (
          <span style={{ fontFamily: 'var(--font-family-primary)', fontWeight: 700, fontSize: numberFont, color: '#9f9fa9', fontVariantNumeric: 'tabular-nums' }}>—</span>
        ) : size >= 90 ? (
          <CountUpNumber value={s} font={numberFont} />
        ) : (
          <span style={{ position: 'relative', display: 'inline-flex', height: numberFont * 1.1, overflow: 'hidden', lineHeight: 1 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={s}
                initial={reduced ? false : { y: '70%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduced ? { opacity: 0 } : { y: '-70%', opacity: 0 }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
                style={{ display: 'inline-block', fontFamily: 'var(--font-family-primary)', fontWeight: 700, fontSize: numberFont, color: '#18181B', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
              >
                {s}
              </motion.span>
            </AnimatePresence>
          </span>
        )}
      </div>

      {delta != null && delta > 0 && <DeltaBadge delta={delta} placement={deltaPlacement} />}
    </div>
  );
};

export default ScoreGauge;
