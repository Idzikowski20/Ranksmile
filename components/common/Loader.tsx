import React from 'react';
import { motion } from 'motion/react';

type LoaderSize = 'sm' | 'md' | 'lg';

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  size?: LoaderSize;
}

const SIZE: Record<
  LoaderSize,
  {
    ring: number;
    titleSize: number;
    titleWeight: number;
    subtitleSize: number;
    textGap: number;
    maxWidth: number;
  }
> = {
  sm: {
    ring: 80,
    titleSize: 14,
    titleWeight: 500,
    subtitleSize: 12,
    textGap: 8,
    maxWidth: 192,
  },
  md: {
    ring: 128,
    titleSize: 16,
    titleWeight: 500,
    subtitleSize: 14,
    textGap: 12,
    maxWidth: 224,
  },
  lg: {
    ring: 160,
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

type RingSpec = {
  background: string;
  mask: string;
  opacity: number;
  duration: number;
  reverse?: boolean;
  ease?: 'linear' | [number, number, number, number];
};

const RINGS: RingSpec[] = [
  {
    background:
      'conic-gradient(from 0deg, transparent 0deg, rgb(24, 18, 37) 90deg, transparent 180deg)',
    mask: 'radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)',
    opacity: 0.8,
    duration: 3,
    ease: 'linear',
  },
  {
    background:
      'conic-gradient(from 0deg, transparent 0deg, rgb(24, 18, 37) 120deg, rgba(24, 18, 37, 0.5) 240deg, transparent 360deg)',
    mask: 'radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 48%, transparent 50%)',
    opacity: 0.9,
    duration: 2.5,
    ease: EASE_SOFT,
  },
  {
    background:
      'conic-gradient(from 180deg, transparent 0deg, rgba(48, 46, 54, 0.6) 45deg, transparent 90deg)',
    mask: 'radial-gradient(circle at 50% 50%, transparent 52%, black 54%, black 56%, transparent 58%)',
    opacity: 0.35,
    duration: 4,
    reverse: true,
    ease: EASE_SOFT,
  },
  {
    background:
      'conic-gradient(from 270deg, transparent 0deg, rgba(48, 46, 54, 0.4) 20deg, transparent 40deg)',
    mask: 'radial-gradient(circle at 50% 50%, transparent 61%, black 62%, black 63%, transparent 64%)',
    opacity: 0.5,
    duration: 3.5,
    ease: 'linear',
  },
];

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
        gap: 32,
        padding: 32,
        fontFamily: FONT,
        ...style,
      }}
      {...props}
    >
      <motion.div
        animate={{ scale: [1, 1.02, 1] }}
        style={{
          position: 'relative',
          width: config.ring,
          height: config.ring,
          flexShrink: 0,
        }}
        transition={{
          duration: 4,
          repeat: Number.POSITIVE_INFINITY,
          ease: EASE_SOFT,
        }}
      >
        {RINGS.map((ring, i) => (
          <motion.div
            key={i}
            animate={{ rotate: ring.reverse ? [0, -360] : [0, 360] }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: ring.background,
              maskImage: ring.mask,
              WebkitMaskImage: ring.mask,
              opacity: ring.opacity,
            }}
            transition={{
              duration: ring.duration,
              repeat: Number.POSITIVE_INFINITY,
              ease: ring.ease ?? 'linear',
            }}
          />
        ))}
      </motion.div>

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
          transition={{ delay: 0.4, duration: 1, ease: EASE_OUT }}
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
              transition={{ delay: 0.6, duration: 0.8, ease: EASE_OUT }}
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
              transition={{ delay: 0.8, duration: 0.8, ease: EASE_OUT }}
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
