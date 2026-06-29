import React from 'react';
import { motion } from 'motion/react';

/**
 * Warm ambient glow around the editor while Surfy / AI is working — a soft, diffuse amber wash that
 * bleeds in from the corners (strongest at the top), fading to a transparent centre so the content
 * stays readable. No thin ring: layered radial gradients, gently breathing while active.
 */
const GLOW_CSS = `
.ai-glow-amber {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(58% 46% at 0% 0%, rgba(255,176,102,0.62) 0%, rgba(255,138,74,0.26) 32%, transparent 62%),
    radial-gradient(58% 46% at 100% 0%, rgba(255,158,86,0.60) 0%, rgba(255,126,68,0.24) 32%, transparent 62%),
    radial-gradient(52% 42% at 0% 100%, rgba(255,150,82,0.30) 0%, transparent 58%),
    radial-gradient(52% 42% at 100% 100%, rgba(255,148,80,0.28) 0%, transparent 58%);
  filter: blur(6px) saturate(1.05);
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
