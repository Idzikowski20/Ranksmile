import { css, type SerializedStyles } from '@emotion/react';

const reduce = '@media (prefers-reduced-motion: reduce)';

/** Interaction budget < 200ms for hover / tooltip. */
export const chartMotion = {
  hoverMs: 120,
  tooltipMs: 120,
  appearMs: 240,
} as const;

export const chartAppear: SerializedStyles = css`
  animation: koala-chart-appear ${chartMotion.appearMs}ms ease both;
  ${reduce} {
    animation: none;
  }
  @keyframes koala-chart-appear {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;
