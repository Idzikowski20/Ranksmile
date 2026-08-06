import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../tokens/semantic';
import { typeface, textScale, fontWeight } from '../../tokens/typography';
import { spacing } from '../../tokens/spacing';
import { radius } from '../../tokens/effects';

export type ProgressBarProps = {
  /** Left label, e.g. a flow/section name. */
  label: string;
  /** Number of steps completed (filled segments). */
  completed: number;
  /** Total number of steps (segments rendered). */
  total: number;
  className?: string;
  style?: React.CSSProperties;
};

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  width: 100%;
`;

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing.lg};
  font-family: ${typeface.body};
  font-size: ${textScale.xs.fontSize};
  line-height: ${textScale.xs.lineHeight};
  letter-spacing: ${textScale.xs.letterSpacing};
`;

const Label = styled.p`
  margin: 0;
  flex: 1 0 0;
  min-width: 0;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
`;

const Count = styled.p`
  margin: 0;
  flex-shrink: 0;
  white-space: nowrap;
  color: ${semantic.text.tertiary};
`;

const Track = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.md};
  height: 6px;
  width: 100%;
`;

const Segment = styled.div<{ $filled: boolean }>(({ $filled }) => ({
  flex: '1 0 0',
  minWidth: 1,
  height: '100%',
  borderRadius: radius.full,
  background: $filled ? semantic.background.brand : semantic.border.primary,
  transition: 'background 200ms ease',
}));

/** Koala ProgressBar (Figma `7674:106575`) — label + "N of M done" + segmented track. */
export function ProgressBar({ label, completed, total, className, style }: ProgressBarProps) {
  return (
    <Root className={className} style={style}>
      <Row>
        <Label>{label}</Label>
        <Count>{completed} of {total} done</Count>
      </Row>
      <Track>
        {Array.from({ length: total }, (_, i) => (
          <Segment key={i} $filled={i < completed} />
        ))}
      </Track>
    </Root>
  );
}

export default ProgressBar;
