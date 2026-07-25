import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface AITextLoadingProps {
  texts?: string[];
  /** Matches Ranksmile Thinking label by default (12.5px / 500). */
  style?: React.CSSProperties;
  className?: string;
  interval?: number;
}

const FONT = 'var(--font-family-primary)';

export default function AITextLoading({
  texts = [
    'Thinking...',
    'Processing...',
    'Analyzing...',
    'Computing...',
    'Almost...',
  ],
  style,
  className,
  interval = 1500,
}: AITextLoadingProps) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
    }, interval);
    return () => clearInterval(timer);
  }, [interval, texts.length]);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        position: 'relative',
        ...style,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={currentTextIndex}
          animate={{
            opacity: 1,
            y: 0,
            backgroundPosition: ['200% center', '-200% center'],
          }}
          exit={{ opacity: 0, y: -6 }}
          initial={{ opacity: 0, y: 6 }}
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            fontFamily: FONT,
            fontSize: 12.5,
            fontWeight: 500,
            lineHeight: '18px',
            letterSpacing: '-0.01em',
            backgroundImage:
              'linear-gradient(90deg, #181225 0%, #9F9FA9 45%, #181225 90%)',
            backgroundSize: '200% 100%',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            WebkitTextFillColor: 'transparent',
          }}
          transition={{
            opacity: { duration: 0.25 },
            y: { duration: 0.25 },
            backgroundPosition: {
              duration: 2.5,
              ease: 'linear',
              repeat: Number.POSITIVE_INFINITY,
            },
          }}
        >
          {texts[currentTextIndex]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
