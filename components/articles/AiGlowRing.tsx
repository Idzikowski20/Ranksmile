import React, { useEffect } from 'react';
import { motion, useMotionValue, useMotionTemplate, animate } from 'motion/react';

/**
 * Diffuse, flowing multi-colour halo around the editor shell while Surfy / AI is working.
 * A heavily-blurred conic-gradient masked to a soft frame; the gradient ANGLE is driven by
 * Motion (continuous rotation) so the colours flow around the window — a Claude-style ambient
 * glow, spread out instead of concentrated in one spot. Animation runs only while `active`.
 *
 * The mask-composite recipe (border-box layer XOR content-box layer = ring) lives in a real CSS
 * RULE, not React inline styles: setting `mask` + `mask-composite` inline got the composite dropped,
 * so the whole conic gradient filled the area instead of a thin ring.
 */
const RING_CSS = `
.ai-glow-ring__frame {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 12px;
  filter: blur(10px);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}`;

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
      <style>{RING_CSS}</style>
      <motion.div
        className="ai-glow-ring__frame"
        animate={active ? { opacity: [0.78, 1, 0.78] } : { opacity: 0.9 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background }}
      />
    </motion.div>
  );
};

export default AiGlowRing;
