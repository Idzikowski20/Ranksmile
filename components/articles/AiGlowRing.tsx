import React from 'react';
import { motion } from 'motion/react';

/**
 * Warm ambient glow around the editor while Surfy / AI is working — a soft, diffuse amber frame that
 * bleeds in from ALL FOUR edges (top, bottom, left, right), fading to a transparent centre so the
 * content stays readable. Corners are naturally a touch brighter where adjacent edges overlap.
 * No thin ring: layered edge gradients + blur, gently breathing while active.
 */
const GLOW_CSS = `
.ai-glow-amber {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    linear-gradient(to bottom, rgba(255,170,96,0.62) 0%, rgba(255,140,74,0.18) 9%, transparent 20%),
    linear-gradient(to top,    rgba(255,152,84,0.52) 0%, rgba(255,132,70,0.15) 9%, transparent 20%),
    linear-gradient(to right,  rgba(255,160,88,0.55) 0%, rgba(255,134,72,0.15) 7%, transparent 15%),
    linear-gradient(to left,   rgba(255,160,88,0.55) 0%, rgba(255,134,72,0.15) 7%, transparent 15%);
  filter: blur(7px) saturate(1.05);
  animation: ai-glow-amber-breathe 4.5s ease-in-out infinite;
}
.ai-glow-amber.is-idle { animation-play-state: paused; }
@keyframes ai-glow-amber-breathe {
  0%, 100% { opacity: 0.78; }
  50% { opacity: 1; }
}`;

const AiGlowRing = ({ active }: { active: boolean }) => (
  <motion.div
    aria-hidden="true"
    initial={false}
    animate={{ opacity: active ? 1 : 0 }}
    transition={{ duration: 0.6, ease: 'easeInOut' }}
    style={{ position: 'absolute', inset: 0, borderRadius: 12, pointerEvents: 'none', zIndex: 9999 }}
  >
    <style>{GLOW_CSS}</style>
    {/* Kept mounted for the fade-out; the breathe pauses (no CPU) while idle. */}
    <div className={`ai-glow-amber${active ? '' : ' is-idle'}`} />
  </motion.div>
);

export default AiGlowRing;
