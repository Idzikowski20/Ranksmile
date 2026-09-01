import React from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { semantic } from '../koala/tokens/semantic';
import { Icon } from '../koala/icons';

/**
 * Progress card — the landing page's brand-setup widget (components/landing/sections/Solution.tsx)
 * reused for live pipelines: a stacked list where each row carries its own state marker.
 */

export type ProgressState = 'pending' | 'active' | 'done' | 'error';

const spin = keyframes`to { transform: rotate(360deg); }`;
const fade = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
`;

const Card = styled.div`
  width: 100%;
  box-sizing: border-box;
  padding: 2px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 18px;
  background: ${semantic.background.secondary};
  display: flex;
  flex-direction: column;
  font-family: var(--font-family-primary);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 600;
  color: ${semantic.text.primary};
`;

const Rows = styled.div`
  display: flex;
  flex-direction: column;
  background: ${semantic.background.primary};
  border: 1px solid ${semantic.border.primary};
  border-radius: 16px;
  overflow: hidden;
`;

const Row = styled.div<{ $state: ProgressState }>`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 10px 16px;
  box-sizing: border-box;
  font-size: 14px;
  line-height: 20px;
  color: ${(p) => (p.$state === 'pending' ? semantic.text.tertiary : semantic.text.primary)};
  font-weight: ${(p) => (p.$state === 'active' ? 600 : 500)};
  border-top: 1px solid ${semantic.border.primary};
  &:first-of-type { border-top: none; }
  animation: ${(p) => (p.$state === 'active' ? fade : 'none')} 1.8s ease-in-out infinite;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Label = styled.span`
  flex: 1;
  min-width: 0;
`;

const Detail = styled.span`
  display: block;
  font-size: 13px;
  font-weight: 400;
  color: ${semantic.text.tertiary};
`;

const Ring = styled.span`
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 2px solid ${semantic.border.primary};
  border-top-color: ${semantic.text.primary};
  animation: ${spin} 900ms linear infinite;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Dashed = styled.span`
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 2px dashed ${semantic.border.strong};
  opacity: 0.7;
`;

const Marker = ({ state, silent }: { state: ProgressState; silent?: boolean }) => {
  const cls = `progress-row-marker progress-row-marker--${state}`;
  if (state === 'done') {
    return <Icon name="CheckCircle" size={20} weight="fill" color="var(--koala-status-success)" className={cls} aria-hidden={silent || undefined} />;
  }
  if (state === 'error') {
    return <Icon name="XCircle" size={20} weight="fill" color="var(--koala-status-danger)" className={cls} aria-hidden={silent || undefined} />;
  }
  // `silent`: caller (e.g. AnalysisProgressPanel) already announces progress through one
  // live region, so drop role="status" here to avoid a duplicate screen-reader announcement.
  if (state === 'active') {
    return silent
      ? <Ring className={cls} aria-hidden="true" />
      : <Ring className={cls} role="status" aria-label="In progress" />;
  }
  return <Dashed className={cls} aria-hidden="true" />;
};

export type ProgressCardRow = {
  id: string;
  label: React.ReactNode;
  detail?: React.ReactNode;
  state: ProgressState;
  /** Spoken form of the row — the visible label alone drops the state. */
  ariaLabel?: string;
};

const ProgressCard = ({ title, icon, trailing, rows, headingLevel, silentMarkers }: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  rows: ProgressCardRow[];
  /** Render the title as a heading at this level so groups are navigable by AT. */
  headingLevel?: number;
  /** Hide row markers from AT — for callers that announce progress via their own live region. */
  silentMarkers?: boolean;
}) => (
  <Card>
    {title ? (
      <Header>
        {icon}
        <span
          style={{ flex: 1, minWidth: 0 }}
          role={headingLevel ? 'heading' : undefined}
          aria-level={headingLevel}
        >
          {title}
        </span>
        {trailing}
      </Header>
    ) : null}
    <Rows>
      {rows.map((row) => (
        <Row
          key={row.id}
          $state={row.state}
          className={`progress-row progress-row--${row.state}`}
          aria-label={row.ariaLabel}
        >
          <Label>
            {row.label}
            {row.detail ? <Detail>{row.detail}</Detail> : null}
          </Label>
          <Marker state={row.state} silent={silentMarkers} />
        </Row>
      ))}
    </Rows>
  </Card>
);

export default ProgressCard;
