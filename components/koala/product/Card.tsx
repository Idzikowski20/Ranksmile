import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface } from '../tokens/typography';
import { shadow } from '../tokens/effects';

const Root = styled.div<{ $padded: boolean; $shadow: boolean }>`
  background: ${semantic.card.bg};
  border: 1px solid ${semantic.card.border};
  border-radius: ${semantic.card.radius};
  box-shadow: ${(p) => (p.$shadow ? shadow.xs : 'none')};
  padding: ${(p) => (p.$padded ? '20px' : '0')};
  font-family: ${typeface.body};
`;

const Title = styled.h3`
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: ${semantic.text.primary};
  letter-spacing: -0.25px;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${semantic.text.secondary};
  line-height: 20px;
`;

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ children, className, padded = true, elevated = false }: CardProps) {
  return (
    <Root className={className} $padded={padded} $shadow={elevated}>
      {children}
    </Root>
  );
}

export function CardHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
      <div>
        <Title>{title}</Title>
        {subtitle ? <Sub>{subtitle}</Sub> : null}
      </div>
      {action}
    </div>
  );
}

export default Card;
