import React from 'react';
import styled from '@emotion/styled';
import { DataToolbar } from './DataToolbar';
import type { DataToolbarProps } from './DataToolbar';
import { spacing } from '../tokens/spacing';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';

const Root = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${spacing.sm};
  padding: ${spacing.lg} 0 ${spacing.md};
  font-family: ${typeface.body};
`;

const Title = styled.h3`
  margin: 0;
  font-size: ${textScale.lg.fontSize};
  line-height: ${textScale.lg.lineHeight};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
`;

const TitleMeta = styled.span`
  font-size: ${textScale.base.fontSize};
  font-weight: ${fontWeight.regular};
  color: ${semantic.text.secondary};
`;

/** Table owns its chrome — pattern only clips overflow. */
const TableWrap = styled.div`
  overflow: auto;
  min-height: 0;
`;

const PaginationSlot = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.lg};
  padding: ${spacing.lg} 0;
`;

export type TablePatternProps = {
  /** Optional page-section title above the table (e.g. Tracked Keywords). */
  title?: React.ReactNode;
  titleMeta?: React.ReactNode;
  toolbar?: Omit<DataToolbarProps, 'className'>;
  children: React.ReactNode;
  pagination?: React.ReactNode;
  className?: string;
};

export function TablePattern({
  title,
  titleMeta,
  toolbar,
  children,
  pagination,
  className,
}: TablePatternProps) {
  return (
    <Root className={className}>
      {toolbar ? <DataToolbar {...toolbar} /> : null}
      {title != null ? (
        <TitleRow>
          <Title>{title}</Title>
          {titleMeta != null ? <TitleMeta>{titleMeta}</TitleMeta> : null}
        </TitleRow>
      ) : null}
      <TableWrap>{children}</TableWrap>
      {pagination ? <PaginationSlot>{pagination}</PaginationSlot> : null}
    </Root>
  );
}

export default TablePattern;
