import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import SurfyMarkdown from './SurfyMarkdown';

type Props = {
  text: string;
  /** When true, shows a blinking caret at the end (live SSE). */
  streaming?: boolean;
};

/** Target reveal rate — slightly behind raw SSE so sections don't dump in bursts. */
const BASE_CPS = 38;
/** When the buffer lags far behind the stream, speed up so we don't stall forever. */
const CATCHUP_CPS = 72;
const LAG_CATCHUP = 64;

const CARET_CSS = `
@keyframes surfy-stream-caret {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.surfy-stream-caret {
  display: inline-block;
  width: 2px;
  height: 14px;
  margin-left: 3px;
  vertical-align: -2px;
  background: #F29964;
  border-radius: 1px;
  animation: surfy-stream-caret 1s steps(1) infinite;
}
@keyframes surfy-stream-glow {
  from { filter: blur(0.4px); opacity: 0.72; }
  to { filter: none; opacity: 1; }
}
.surfy-stream-body.is-live .surfy-md {
  animation: surfy-stream-glow 0.28s ease-out;
}
`;

/**
 * Live Surfy reply — grows with SSE deltas, ChatGPT-style caret + soft entrance.
 * Reveals text through a paced buffer so large model chunks don't appear as whole sections.
 */
export default function SurfyStreamingMessage({ text, streaming = true }: Props) {
  const [entered, setEntered] = useState(false);
  const [visible, setVisible] = useState('');
  const glowRef = useRef<HTMLDivElement>(null);
  const prevVisibleLen = useRef(0);
  const targetRef = useRef(text);
  const visibleRef = useRef('');

  useEffect(() => {
    setEntered(true);
  }, []);

  useEffect(() => {
    targetRef.current = text;
  }, [text]);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    let last = performance.now();
    let carry = 0;

    const tick = (now: number) => {
      if (!alive) return;
      const dt = Math.min(80, now - last);
      last = now;
      const target = targetRef.current;
      let current = visibleRef.current;

      // Stream truncated / reset (new turn).
      if (current.length > 0 && !target.startsWith(current)) {
        current = '';
        visibleRef.current = '';
        setVisible('');
        prevVisibleLen.current = 0;
        carry = 0;
      }

      const lag = target.length - current.length;
      if (lag > 0) {
        const cps = lag > LAG_CATCHUP ? CATCHUP_CPS : BASE_CPS;
        carry += (cps * dt) / 1000;
        const n = Math.floor(carry);
        if (n > 0) {
          carry -= n;
          const next = target.slice(0, current.length + n);
          visibleRef.current = next;
          setVisible(next);
        }
      } else {
        carry = 0;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (visible.length <= prevVisibleLen.current) {
      prevVisibleLen.current = visible.length;
      return;
    }
    prevVisibleLen.current = visible.length;
    const el = glowRef.current;
    if (!el) return;
    el.classList.remove('is-live');
    void el.offsetWidth;
    el.classList.add('is-live');
  }, [visible]);

  const catchingUp = visible.length < text.length;
  const showCaret = streaming || catchingUp;

  if (!text && !visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: entered ? 1 : 0, y: entered ? 0 : 10 }}
      transition={{ duration: 0.36, ease: [0.4, 0, 0.2, 1] }}
    >
      <style>{CARET_CSS}</style>
      <div ref={glowRef} className="surfy-stream-body">
        <SurfyMarkdown>{visible}</SurfyMarkdown>
      </div>
      {showCaret ? <span className="surfy-stream-caret" aria-hidden /> : null}
    </motion.div>
  );
}
