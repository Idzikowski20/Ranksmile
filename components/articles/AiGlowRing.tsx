import React from 'react';
import { motion } from 'motion/react';

/**
 * Diffuse, flowing multi-colour halo around the editor shell while Surfy / AI is working.
 *
 * Uses an animated DIAGONAL LINEAR gradient (sweeping background-position), NOT a conic one: a conic
 * gradient centred on the (very wide) editor gives the long vertical sides almost no angular range,
 * so the left/right edges always collapse to a single colour. A diagonal linear gradient with a
 * moving background-position shows multi-colour bands flowing evenly across every edge.
 *
 * The mask-composite recipe (border-box layer XOR content-box layer = ring) and the gradient flow
 * both live in a real CSS RULE, not React inline styles: setting `mask`/`mask-composite` inline got
 * the composite dropped (whole area filled instead of a ring), and CSS keyframes drive the flow.
 */
const RING_CSS = `
.ai-glow-ring__frame {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 14px;
  background: linear-gradient(115deg, #783afb, #c026d3, #ec4899, #fb7185, #22d3ee, #3b82f6, #8b5cf6, #783afb);
  background-size: 220% 220%;
  filter: blur(8px) saturate(1.3);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: ai-glow-flow 9s ease-in-out infinite, ai-glow-pulse 3.4s ease-in-out infinite;
}
.ai-glow-ring__frame.is-idle { animation-play-state: paused; }
@keyframes ai-glow-flow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes ai-glow-pulse { 0%, 100% { opacity: 0.82; } 50% { opacity: 1; } }`;

const AiGlowRing = ({ active }: { active: boolean }) => (
  <motion.div
    aria-hidden="true"
    initial={false}
    animate={{ opacity: active ? 1 : 0 }}
    transition={{ duration: 0.5, ease: 'easeInOut' }}
    style={{ position: 'absolute', inset: 0, borderRadius: 12, pointerEvents: 'none', zIndex: 9999 }}
  >
    <style>{RING_CSS}</style>
    {/* Kept mounted for the fade-out; animation pauses (no CPU) while idle. */}
    <div className={`ai-glow-ring__frame${active ? '' : ' is-idle'}`} />
  </motion.div>
);

export default AiGlowRing;
