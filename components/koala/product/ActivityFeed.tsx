import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface } from '../tokens/typography';
import { greyNeutral } from '../tokens/colors';

const Row = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid ${semantic.border.primary};
  font-family: ${typeface.body};
  &:last-child {
    border-bottom: none;
  }
`;

const Dot = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 999px;
  background: ${(p) => p.$color};
  flex-shrink: 0;
`;

const Body = styled.div`
  min-width: 0;
  flex: 1;
`;

const Title = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${semantic.text.primary};
  letter-spacing: -0.4px;
`;

const Meta = styled.div`
  font-size: 12px;
  color: ${semantic.text.tertiary};
  margin-top: 2px;
`;

export type ActivityItem = {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  tone?: 'grey' | 'brand' | 'success' | 'danger' | 'blue';
};

const TONE: Record<NonNullable<ActivityItem['tone']>, string> = {
  grey: greyNeutral[400],
  brand: semantic.focus,
  success: semantic.status.success,
  danger: semantic.status.danger,
  blue: '#3b82f6',
};

/** Product component — Activity Feed item (Figma `6993:61462`). */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div>
      {items.map((item) => (
        <Row key={item.id}>
          <Dot $color={TONE[item.tone ?? 'grey']} />
          <Body>
            <Title>{item.title}</Title>
            {item.meta ? <Meta>{item.meta}</Meta> : null}
          </Body>
        </Row>
      ))}
    </div>
  );
}

export default ActivityFeed;
