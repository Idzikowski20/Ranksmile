import React, { useEffect } from 'react';
import { motion, useMotionValue, useMotionTemplate, animate } from 'motion/react';

/**
 * Diffuse, flowing multi-colour halo around the editor shell while Surfy / AI is working.
 * A heavily-blurred conic-gradient masked to a soft frame; the gradient ANGLE is driven by
 * Motion (continuous rotation) so the colours flow around the window — a Claude-style ambient
 * glow, spread out instead of concentrated in one spot. Animation runs only while `active`.
 */
const AiGlowRing = ({ active }: { active: boolean }) => {
  const angle = useMotionValue(0);

  useEffect(() => {
    if (!active) return undefined;
    const controls = animate(angle, 360, { duration: 7, repeat: Infinity, ease: 'linear' });
    return () => controls.stop();
  }, [active, angle]);

  // Soft brand-leaning blend (purple → cyan → violet → pink), rotated by Motion.
  const background = useMotionTemplate`conic-gradient(from ${angle}deg at 50% 50%, #783afb, #06b6d4, #8b5cf6, #ec4899, #783afb)`;

  return (
    <motion.div
      aria-hidden="true"
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      style={{ position: 'absolute', inset: 0, borderRadius: 12, pointerEvents: 'none', zIndex: 9999 }}
    >
      <motion.div
        animate={active ? { opacity: [0.78, 1, 0.78] } : { opacity: 0.9 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background,
          padding: 14, // ring thickness — the frame the mask keeps
          filter: 'blur(11px)', // spreads the colour into a diffuse halo at the edge
          // Ring = border-box layer XOR content-box layer → only the padding frame remains.
          // IMPORTANT: the mask SHORTHANDS must come BEFORE the *-composite props; otherwise the
          // shorthand resets composite to "add" and the whole area fills (instead of a thin ring).
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MotionValue bg + vendor mask-composite
        } as any}
      />
    </motion.div>
  );
};

export default AiGlowRing;
