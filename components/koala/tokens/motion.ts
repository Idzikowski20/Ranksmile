/** Koala motion tokens — duration, easing, composed transitions. */

export const motionDuration = {
  fast: 120,
  moderate: 160,
  slow: 240,
} as const;

export const motionEasing = {
  smooth: [0.72, 0, 0.16, 1] as const,
  snap: [0.8, -0.4, 0.5, 1] as const,
  enter: [0.24, 1, 0.32, 1] as const,
  exit: [0.64, 0, 0.8, 0] as const,
};

function cssTransition(ms: number, easing: readonly number[]) {
  return `${ms}ms cubic-bezier(${easing.join(', ')})`;
}

export const motionTransition = {
  fade: {
    fast: cssTransition(motionDuration.fast, motionEasing.smooth),
    moderate: cssTransition(motionDuration.moderate, motionEasing.smooth),
    slow: cssTransition(motionDuration.slow, motionEasing.smooth),
  },
  enter: {
    fast: cssTransition(motionDuration.fast, motionEasing.enter),
    moderate: cssTransition(motionDuration.moderate, motionEasing.enter),
    slow: cssTransition(motionDuration.slow, motionEasing.enter),
  },
  exit: {
    fast: cssTransition(motionDuration.fast, motionEasing.exit),
    moderate: cssTransition(motionDuration.moderate, motionEasing.exit),
    slow: cssTransition(motionDuration.slow, motionEasing.exit),
  },
  snap: {
    fast: cssTransition(motionDuration.fast, motionEasing.snap),
    moderate: cssTransition(motionDuration.moderate, motionEasing.snap),
  },
} as const;

export const motionSpring = {
  fast: { type: 'spring' as const, stiffness: 1400, damping: 50 },
  moderate: { type: 'spring' as const, stiffness: 1000, damping: 50 },
  slow: { type: 'spring' as const, stiffness: 600, damping: 50 },
} as const;
