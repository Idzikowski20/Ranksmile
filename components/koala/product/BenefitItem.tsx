import React from 'react';
import styled from '@emotion/styled';
import { Icon } from '../icons/Icon';
import type { BenefitState } from '../../../lib/pricing/planDefinition';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { spacing } from '../tokens/spacing';

export type BenefitItemProps = {
  label: string;
  state: BenefitState;
  value?: string;
  className?: string;
};

const Row = styled.div<{ $dimmed: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: ${spacing.sm};
  opacity: ${(p) => (p.$dimmed ? 0.5 : 1)};
  font-family: ${typeface.body};
`;

const Label = styled.span`
  flex: 1;
  min-width: 0;
  font-size: ${textScale.base.fontSize};
  line-height: ${textScale.base.lineHeight};
  font-weight: ${fontWeight.medium};
  letter-spacing: ${textScale.base.letterSpacing};
  color: ${semantic.text.primary};
`;

const Value = styled.span`
  flex-shrink: 0;
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.secondary};
`;

function iconFor(state: BenefitState): { name: 'CheckCircle' | 'XCircle'; color: string } {
  if (state === 'excluded') {
    return { name: 'XCircle', color: semantic.text.tertiary };
  }
  return { name: 'CheckCircle', color: state === 'partial' ? semantic.status.success : semantic.status.success };
}

/** Koala Benefit Item — included / partial (value) / excluded. */
export function BenefitItem({ label, state, value, className }: BenefitItemProps) {
  const icon = iconFor(state);
  const display = state === 'partial' && value
    ? `${label}: ${value}`
    : label;

  return (
    <Row className={className} $dimmed={state === 'excluded'} data-benefit-state={state}>
      <Icon name={icon.name} size={20} weight="fill" color={icon.color} aria-hidden />
      <Label>{display}</Label>
      {state === 'partial' && value ? null : value ? <Value>{value}</Value> : null}
    </Row>
  );
}

export default BenefitItem;
