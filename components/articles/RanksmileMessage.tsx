import React, { useState } from 'react';
import { motion } from 'motion/react';
import RanksmileMarkdown from './RanksmileMarkdown';
import { shouldShowRanksmileThinkingDisclosure } from '../../lib/ai/text';

type Props = {
  role: 'user' | 'assistant';
  message: string;
  /** The agent's interim narration (between tool calls), shown as a collapsed "Thinking" disclosure. */
  thinking?: string;
  /** Fade/slide entrance — use for newly completed assistant turns. */
  animateEnter?: boolean;
};

/** Collapsed-by-default "Thinking" disclosure (the agent's between-step narration). */
const Thinking = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 4px', margin: '-2px -4px', borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#9f9fa9', fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font-family-primary)', transition: 'color 150ms ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#52525c'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#9f9fa9'; }}
      >
        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}><path d="M9 18l6-6-6-6" /></svg>
        Thinking
      </button>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid #f0f0f2', color: '#9f9fa9', fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {text}
        </div>
      )}
    </div>
  );
};

/** One Ranksmile chat message, Twenty-style in the app's light theme:
 *  user = subtle grey bubble (right, fit-content); assistant = optional thinking + markdown body. */
const RanksmileMessage = ({ role, message, thinking, animateEnter = false }: Props) => {
  if (role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            maxWidth: '88%', background: '#f4f4f5', color: '#18181b',
            borderRadius: 12, borderBottomRightRadius: 4, padding: '8px 12px',
            fontSize: 14, lineHeight: '20px', fontWeight: 500,
            fontFamily: 'var(--font-family-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}
        >
          {message}
        </div>
      </div>
    );
  }

  const showThinking = shouldShowRanksmileThinkingDisclosure(thinking, message);

  const body = (
    <div>
      {showThinking && thinking ? <Thinking text={thinking} /> : null}
      {message ? <RanksmileMarkdown>{message}</RanksmileMarkdown> : null}
    </div>
  );

  if (!animateEnter) return body;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      {body}
    </motion.div>
  );
};

export default RanksmileMessage;
