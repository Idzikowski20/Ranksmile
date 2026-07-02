import React, { useEffect, useRef } from 'react';
import { gsap, useGSAP, DURATION, EASE, registerMotionPlugins, prefersReducedMotion } from '../../lib/motion/gsap';

interface Props {
  label: string;
  onDone: () => void;
}

const HOLD_MS = 2500;

/**
 * Self-removing floating chip — rises + fades in (~0.2s), holds, then fades out, calling
 * `onDone` when finished so the caller can unmount it. Positioned by the caller (absolute,
 * relative to its offset parent). Reduced motion → renders statically and calls `onDone` after
 * the same ~2.5s hold via setTimeout (cleaned up on unmount).
 */
const AoScoreFloat = ({ label, onDone }: Props) => {
  const ref = useRef<HTMLSpanElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useGSAP(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return undefined;
    registerMotionPlugins();
    const tl = gsap.timeline({ onComplete: () => onDoneRef.current() });
    tl.from(el, { opacity: 0, y: 8, duration: DURATION.fast, ease: EASE.out });
    tl.to(el, { opacity: 0, duration: DURATION.slow, ease: EASE.in }, `+=${HOLD_MS / 1000 - DURATION.fast - DURATION.slow}`);
    return () => { tl.kill(); };
  }, { scope: ref });

  useEffect(() => {
    if (!prefersReducedMotion()) return undefined;
    const t = setTimeout(() => onDoneRef.current(), HOLD_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <span
      ref={ref}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 60,
        color: '#1AB25E',
        fontWeight: 600,
        fontFamily: 'var(--font-family-primary)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 13,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
};

export default AoScoreFloat;
