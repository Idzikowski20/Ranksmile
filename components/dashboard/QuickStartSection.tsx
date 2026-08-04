import React from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { WidgetShell } from '../koala/product';
import { Icon } from '../koala/icons/Icon';
import { semantic } from '../koala/tokens/semantic';
import { spacing } from '../koala/tokens/spacing';
import { fontWeight, textScale } from '../koala/tokens/typography';

type Action = {
  key: string;
  label: string;
  href: string;
  icon: string;
  badge?: number;
};

type Props = {
  createHref: string;
  optimizeHref: string;
  recommendationsHref: string;
  recommendationsCount?: number;
};

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${spacing.lg};

  @media (max-width: 767px) {
    grid-template-columns: 1fr;
  }
`;

const CardLink = styled.a`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${spacing.md};
  padding: ${spacing.lg} ${spacing.xl};
  border-radius: ${semantic.card.radius};
  background: ${semantic.background.secondary};
  text-decoration: none;
  color: ${semantic.text.primary};
  transition: background-color 150ms ease, color 150ms ease;

  &:hover {
    background: ${semantic.background.tertiary};
    color: ${semantic.text.brand};
  }
`;

const IconBox = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${semantic.background.primary};
  border: 1px solid ${semantic.border.primary};
  color: inherit;
  flex-shrink: 0;
`;

const Label = styled.span`
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  font-weight: ${fontWeight.bold};
  font-family: var(--font-family-primary);
`;

const Badge = styled.span`
  position: absolute;
  top: 12px;
  right: 12px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 9999px;
  background: ${semantic.status.danger};
  color: #fff;
  font-size: 11px;
  font-weight: ${fontWeight.bold};
  line-height: 22px;
  text-align: center;
  font-variant-numeric: tabular-nums;
`;

/** Surfer-style Quick start — title inside WidgetShell like Recommendations. */
const QuickStartSection = ({
  createHref,
  optimizeHref,
  recommendationsHref,
  recommendationsCount = 0,
}: Props) => {
  const actions: Action[] = [
    { key: 'create', label: 'Create Content', href: createHref, icon: 'Feather' },
    { key: 'optimize', label: 'Optimize Content', href: optimizeHref, icon: 'ChartLineUp' },
    {
      key: 'recommendations',
      label: 'View Recommendations',
      href: recommendationsHref,
      icon: 'Lightning',
      badge: recommendationsCount > 0 ? recommendationsCount : undefined,
    },
  ];

  return (
    <div data-testid="dashboard-quick-start">
      <WidgetShell title="Quick start">
        <Grid className="dashboard-quickstart-grid">
          {actions.map((a) => (
            <Link key={a.key} href={a.href} passHref>
              <CardLink className="quickstart-card">
                <IconBox>
                  <Icon name={a.icon} size={20} weight="bold" />
                </IconBox>
                <Label>{a.label}</Label>
                {a.badge != null ? (
                  <Badge aria-label={`${a.badge} recommendations`}>
                    {a.badge > 99 ? '99+' : a.badge}
                  </Badge>
                ) : null}
              </CardLink>
            </Link>
          ))}
        </Grid>
      </WidgetShell>
    </div>
  );
};

export default QuickStartSection;
