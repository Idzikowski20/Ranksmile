import React from 'react';
import { motion } from 'motion/react';
import { BounceSmileyAnimation } from './BounceSmileyAnimation';

type LoaderSize = 'sm' | 'md' | 'lg';

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  size?: LoaderSize;
}

const SIZE: Record<
  LoaderSize,
  {
    mark: number;
    titleSize: number;
    titleWeight: number;
    subtitleSize: number;
    textGap: number;
    maxWidth: number;
  }
> = {
  sm: {
    mark: 72,
    titleSize: 14,
    titleWeight: 500,
    subtitleSize: 12,
    textGap: 8,
    maxWidth: 192,
  },
  md: {
    mark: 112,
    titleSize: 16,
    titleWeight: 500,
    subtitleSize: 14,
    textGap: 12,
    maxWidth: 224,
  },
  lg: {
    mark: 144,
    titleSize: 18,
    titleWeight: 600,
    subtitleSize: 16,
    textGap: 16,
    maxWidth: 256,
  },
};

const FONT = 'var(--font-family-primary)';
const EASE_SOFT: [number, number, number, number] = [0.4, 0, 0.6, 1];
const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

export default function Loader({
  title,
  subtitle = 'Please wait while we prepare everything for you',
  size = 'md',
  className,
  style,
  ...props
}: LoaderProps) {
  const config = SIZE[size];

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: 32,
        fontFamily: FONT,
        ...style,
      }}
      {...props}
    >
      <div
        style={{
          width: config.mark,
          height: config.mark,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden="true"
      >
        <BounceSmileyAnimation compact size={config.mark} entrance={false} />
      </div>

      {(title || subtitle) && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 12 }}
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: config.textGap,
            maxWidth: config.maxWidth,
          }}
          transition={{ delay: 0.25, duration: 0.8, ease: EASE_OUT }}
        >
          {title ? (
            <motion.h1
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 12 }}
              style={{
                margin: 0,
                fontSize: config.titleSize,
                fontWeight: config.titleWeight,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                color: '#181225',
                WebkitFontSmoothing: 'antialiased',
              }}
              transition={{ delay: 0.35, duration: 0.7, ease: EASE_OUT }}
            >
              <motion.span
                animate={{ opacity: [0.9, 0.7, 0.9] }}
                transition={{
                  duration: 3,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: EASE_SOFT,
                }}
              >
                {title}
              </motion.span>
            </motion.h1>
          ) : null}

          {subtitle ? (
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 8 }}
              style={{
                margin: 0,
                fontSize: config.subtitleSize,
                fontWeight: 400,
                lineHeight: 1.45,
                letterSpacing: '-0.01em',
                color: '#181225',
                WebkitFontSmoothing: 'antialiased',
              }}
              transition={{ delay: 0.45, duration: 0.7, ease: EASE_OUT }}
            >
              <motion.span
                animate={{ opacity: [0.6, 0.4, 0.6] }}
                transition={{
                  duration: 4,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: EASE_SOFT,
                }}
              >
                {subtitle}
              </motion.span>
            </motion.p>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}
