import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';

const COLORS = ['#F29964', '#1AB25E', '#F97316', '#74A9FF', '#FF6F77', '#FACC15'];

type Piece = { id: number; left: number; dx: number; delay: number; dur: number; rot: number; color: string; w: number; h: number; round: boolean };

const makePieces = (n: number): Piece[] => Array.from({ length: n }, (_, i) => ({
  id: i,
  left: Math.random() * 100,            // vw
  dx: (Math.random() - 0.5) * 240,      // px horizontal drift
  delay: Math.random() * 0.25,
  dur: 2.2 + Math.random() * 1.4,
  rot: (Math.random() - 0.5) * 720,
  color: COLORS[Math.floor(Math.random() * COLORS.length)],
  w: 7 + Math.random() * 5,
  h: 9 + Math.random() * 7,
  round: Math.random() > 0.6,
}));

/** Full-screen confetti rain. Bump `runKey` (>0) to fire a fresh burst. */
const Confetti = ({ runKey }: { runKey: number }) => {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  useEffect(() => {
    if (!runKey) return undefined;
    setPieces(makePieces(48));
    const t = setTimeout(() => setPieces(null), 4200);
    return () => clearTimeout(t);
  }, [runKey]);

  if (typeof document === 'undefined' || !pieces) return null;
  const fall = (typeof window !== 'undefined' ? window.innerHeight : 900) + 60;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000, overflow: 'hidden' }}>
      {pieces.map((p) => (
        <motion.div key={p.id}
          initial={{ x: 0, y: -30, opacity: 1, rotate: 0 }}
          animate={{ x: p.dx, y: fall, opacity: [1, 1, 0.9, 0], rotate: p.rot }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeIn' }}
          style={{ position: 'absolute', top: 0, left: `${p.left}vw`, width: p.w, height: p.round ? p.w : p.h, borderRadius: p.round ? '50%' : 2, background: p.color }} />
      ))}
    </div>,
    document.body,
  );
};

export default Confetti;
