import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { grid } from '../tokens/effects';

const PageRoot = styled.div<{ $maxWidth: string; $fillHeight?: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: ${(p) => (p.$fillHeight ? '100%' : 'auto')};
  font-family: ${typeface.body};
`;

const PageInner = styled.div<{ $maxWidth: string }>`
  width: 100%;
  max-width: ${(p) => p.$maxWidth};
  margin: 0 auto;
  padding: 0 ${grid.containerPadding};
`;

const SectionRoot = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const HeaderRoot = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing.xl};
  padding-bottom: ${spacing.xl};
  border-bottom: 1px solid ${semantic.border.primary};
`;

const HeaderMain = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${spacing.lg};
  min-width: 0;
`;

const HeaderIcon = styled.span`
  display: flex;
  flex-shrink: 0;
  color: ${semantic.text.secondary};
`;

const HeaderTitles = styled.div`
  min-width: 0;
`;

const HeaderTitle = styled.h1`
  margin: 0;
  font-size: ${textScale['2xl'].fontSize};
  line-height: ${textScale['2xl'].lineHeight};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  letter-spacing: ${textScale['2xl'].letterSpacing};
`;

const HeaderSubtitle = styled.p`
  margin: ${spacing.xs} 0 0;
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  color: ${semantic.text.secondary};
`;

const HeaderActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing.lg};
  flex-shrink: 0;
`;

const ContentGridRoot = styled.div<{ $columns: number; $gap: string }>`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$columns}, minmax(0, 1fr));
  gap: ${(p) => p.$gap};
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const SplitRoot = styled.div<{ $asideWidth: string }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) ${(p) => p.$asideWidth};
  gap: ${spacing['2xl']};
  align-items: start;
  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const SplitMain = styled.div`
  min-width: 0;
`;

const SplitAside = styled.aside`
  min-width: 0;
`;

const WizardRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing['2xl']};
  min-height: 0;
`;

const WizardSteps = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.lg};
`;

const WizardBody = styled.div`
  flex: 1;
  min-height: 0;
`;

const WizardFooter = styled.footer`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.lg};
  padding-top: ${spacing.xl};
  border-top: 1px solid ${semantic.border.primary};
`;

const DashboardRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing['2xl']};
`;

const DashboardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: ${spacing.xl};
  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const DashboardSlot = styled.div<{ $span: number }>`
  grid-column: span ${(p) => p.$span};
  min-width: 0;
  @media (max-width: 960px) {
    grid-column: span 1;
  }
`;

export type PageLayoutProps = {
  children: React.ReactNode;
  maxWidth?: number | string;
  fillHeight?: boolean;
  className?: string;
};

export function PageLayout({ children, maxWidth = grid.containerMax, fillHeight, className }: PageLayoutProps) {
  const maxW = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
  return (
    <PageRoot className={className} $maxWidth={maxW} $fillHeight={fillHeight}>
      <PageInner $maxWidth={maxW}>{children}</PageInner>
    </PageRoot>
  );
}

export type SectionProps = {
  children: React.ReactNode;
  className?: string;
};

export function Section({ children, className }: SectionProps) {
  return <SectionRoot className={className}>{children}</SectionRoot>;
}

export type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, icon, actions, className }: PageHeaderProps) {
  return (
    <HeaderRoot className={className}>
      <HeaderMain>
        {icon ? <HeaderIcon>{icon}</HeaderIcon> : null}
        <HeaderTitles>
          <HeaderTitle>{title}</HeaderTitle>
          {subtitle ? <HeaderSubtitle>{subtitle}</HeaderSubtitle> : null}
        </HeaderTitles>
      </HeaderMain>
      {actions ? <HeaderActions>{actions}</HeaderActions> : null}
    </HeaderRoot>
  );
}

export type PageActionsProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageActions({ children, className }: PageActionsProps) {
  return <HeaderActions className={className}>{children}</HeaderActions>;
}

export type ContentGridProps = {
  children: React.ReactNode;
  columns?: number;
  gap?: string;
  className?: string;
};

export function ContentGrid({ children, columns = 2, gap = spacing.xl, className }: ContentGridProps) {
  return (
    <ContentGridRoot className={className} $columns={columns} $gap={gap}>
      {children}
    </ContentGridRoot>
  );
}

export type SplitLayoutProps = {
  main: React.ReactNode;
  aside: React.ReactNode;
  asideWidth?: string;
  className?: string;
};

export function SplitLayout({ main, aside, asideWidth = '320px', className }: SplitLayoutProps) {
  return (
    <SplitRoot className={className} $asideWidth={asideWidth}>
      <SplitMain>{main}</SplitMain>
      <SplitAside>{aside}</SplitAside>
    </SplitRoot>
  );
}

export type WizardLayoutSlots = {
  steps?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export type WizardLayoutProps = WizardLayoutSlots & { className?: string };

export function WizardLayout({ steps, children, footer, className }: WizardLayoutProps) {
  return (
    <WizardRoot className={className}>
      {steps ? <WizardSteps>{steps}</WizardSteps> : null}
      <WizardBody>{children}</WizardBody>
      {footer ? <WizardFooter>{footer}</WizardFooter> : null}
    </WizardRoot>
  );
}

export type DashboardLayoutSlot = {
  key: string;
  span?: number;
  content: React.ReactNode;
};

export type DashboardLayoutProps = {
  slots: DashboardLayoutSlot[] | Record<string, React.ReactNode>;
  className?: string;
};

function normalizeSlots(slots: DashboardLayoutSlot[] | Record<string, React.ReactNode>): DashboardLayoutSlot[] {
  if (Array.isArray(slots)) return slots;
  return Object.entries(slots).map(([key, content]) => ({ key, content }));
}

export function DashboardLayout({ slots, className }: DashboardLayoutProps) {
  const items = normalizeSlots(slots);
  return (
    <DashboardRoot className={className}>
      <DashboardGrid>
        {items.map((slot) => (
          <DashboardSlot key={slot.key} $span={slot.span ?? 6}>
            {slot.content}
          </DashboardSlot>
        ))}
      </DashboardGrid>
    </DashboardRoot>
  );
}
