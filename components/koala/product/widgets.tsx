import React from 'react';
import styled from '@emotion/styled';
import { Card, CardHeader } from './Card';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { FeedbackFrame, LoadingState, EmptyState, ErrorState } from '../feedback';
import { Chart } from '../charts/Chart';
import { Sparkline } from '../charts/Sparkline';
import type { ChartProps } from '../charts/Chart';
import type { SparklineAppearance } from '../charts/Sparkline';

const WidgetRoot = styled(Card)`
  display: flex;
  flex-direction: column;
  min-height: 0;
  font-family: ${typeface.body};
`;

const WidgetBody = styled.div`
  flex: 1;
  min-height: 0;
`;

const WidgetFooter = styled.div`
  margin-top: ${spacing.lg};
  padding-top: ${spacing.md};
  border-top: 1px solid ${semantic.border.primary};
`;

const MetricRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${spacing.lg};
`;

const MetricValue = styled.div`
  font-size: ${textScale['3xl'].fontSize};
  line-height: ${textScale['3xl'].lineHeight};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  letter-spacing: ${textScale['3xl'].letterSpacing};
`;

const MetricDelta = styled.div<{ $positive?: boolean }>`
  margin-top: ${spacing.xs};
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  color: ${(p) => (p.$positive === undefined ? semantic.text.secondary : p.$positive ? semantic.status.success : semantic.status.danger)};
`;

const ChartArea = styled.div`
  min-height: ${spacing['5xl']};
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
`;

const SparkSlot = styled.div`
  width: 120px;
  flex-shrink: 0;
`;

const ListRoot = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${spacing.lg};
`;

const ListItem = styled.li`
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  color: ${semantic.text.primary};
`;

const ActionBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.lg};
`;

export const DASHBOARD_SLOTS = ['overview', 'seo', 'traffic', 'ai', 'keywords', 'tasks'] as const;

export type DashboardSlot = (typeof DASHBOARD_SLOTS)[number];

export type WidgetRegistry = Record<string, React.ComponentType>;

/** Widget shell states — maps to Chart states (success → ready). */
export type WidgetState = 'loading' | 'empty' | 'error' | 'success' | 'disabled';

export type WidgetShellProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  state?: WidgetState;
  emptyDescription?: React.ReactNode;
  errorDescription?: React.ReactNode;
  disabledDescription?: React.ReactNode;
  className?: string;
  elevated?: boolean;
};

/** Widget never transforms series — children receive already-prepared viz. */
export function WidgetShell({
  title,
  subtitle,
  action,
  actions,
  children,
  footer,
  state = 'success',
  emptyDescription,
  errorDescription,
  disabledDescription,
  className,
  elevated,
}: WidgetShellProps) {
  const headerAction = actions ?? action;
  let body: React.ReactNode = children;
  if (state === 'loading') body = <LoadingState label="Loading…" />;
  else if (state === 'empty') body = <EmptyState description={emptyDescription ?? 'Nothing here yet.'} />;
  else if (state === 'error') body = <ErrorState description={errorDescription ?? 'Something went wrong.'} />;
  else if (state === 'disabled') {
    body = (
      <FeedbackFrame
        title="Unavailable"
        description={disabledDescription ?? 'Not available on your plan.'}
      />
    );
  }

  return (
    <WidgetRoot className={className} elevated={elevated} data-widget-state={state}>
      <CardHeader title={title} subtitle={subtitle} action={headerAction} />
      <WidgetBody>{body}</WidgetBody>
      {footer && state === 'success' ? <WidgetFooter>{footer}</WidgetFooter> : null}
    </WidgetRoot>
  );
}

export type MetricWidgetProps = {
  title: React.ReactNode;
  value: React.ReactNode;
  delta?: React.ReactNode;
  deltaPositive?: boolean;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  state?: WidgetState;
  className?: string;
  /** Prepared spark values — never compute inside widget. */
  sparkline?: {
    appearance: SparklineAppearance;
    values: number[];
    comparisonValues?: number[];
  };
};

export function MetricWidget({
  title, value, delta, deltaPositive, action, actions, footer, state, className, sparkline,
}: MetricWidgetProps) {
  return (
    <WidgetShell title={title} action={action} actions={actions} footer={footer} state={state} className={className}>
      <MetricRow>
        <div>
          <MetricValue>{value}</MetricValue>
          {delta ? <MetricDelta $positive={deltaPositive}>{delta}</MetricDelta> : null}
        </div>
        {sparkline && sparkline.values.length > 0 ? (
          <SparkSlot>
            <Sparkline
              appearance={sparkline.appearance}
              values={sparkline.values}
              comparisonValues={sparkline.comparisonValues}
            />
          </SparkSlot>
        ) : null}
      </MetricRow>
    </WidgetShell>
  );
}

export type ChartWidgetProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  state?: WidgetState;
  emptyDescription?: React.ReactNode;
  errorDescription?: React.ReactNode;
  disabledDescription?: React.ReactNode;
  className?: string;
  /** Declarative Chart props (preset + prepared data). */
  chart?: Omit<ChartProps, 'width' | 'state'>;
  children?: React.ReactNode;
};

function toChartState(state: WidgetState | undefined): ChartProps['state'] {
  if (state === 'loading') return 'loading';
  if (state === 'empty') return 'empty';
  if (state === 'error') return 'error';
  if (state === 'disabled') return 'disabled';
  return 'ready';
}

export function ChartWidget({
  title, subtitle, action, actions, footer, state, emptyDescription, errorDescription, disabledDescription, className, chart, children,
}: ChartWidgetProps) {
  return (
    <WidgetShell
      title={title}
      subtitle={subtitle}
      action={action}
      actions={actions}
      footer={footer}
      state={state}
      emptyDescription={emptyDescription}
      errorDescription={errorDescription}
      disabledDescription={disabledDescription}
      className={className}
    >
      <ChartArea data-testid="dashboard-chart">
        {chart ? (
          <Chart
            {...chart}
            state={toChartState(state)}
            emptyDescription={emptyDescription}
            errorDescription={errorDescription}
            disabledDescription={disabledDescription}
          />
        ) : children}
      </ChartArea>
    </WidgetShell>
  );
}

export type ListWidgetProps = {
  title: React.ReactNode;
  items: React.ReactNode[];
  action?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  state?: WidgetState;
  className?: string;
};

export function ListWidget({ title, items, action, actions, footer, state, className }: ListWidgetProps) {
  const derived = state ?? (items.length ? 'success' : 'empty');
  return (
    <WidgetShell
      title={title}
      action={action}
      actions={actions}
      footer={footer}
      state={derived}
      className={className}
      emptyDescription="No items yet."
    >
      <ListRoot>
        {items.map((item, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <ListItem key={i}>{item}</ListItem>
        ))}
      </ListRoot>
    </WidgetShell>
  );
}

export type ActionWidgetProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  state?: WidgetState;
  className?: string;
};

export function ActionWidget({ title, description, action, actions, children, state, className }: ActionWidgetProps) {
  return (
    <WidgetShell title={title} subtitle={description} action={action} actions={actions} state={state} className={className}>
      <ActionBody>{children}</ActionBody>
    </WidgetShell>
  );
}
