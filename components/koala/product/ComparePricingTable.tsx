import React, { useState } from 'react';
import styled from '@emotion/styled';
import { Button } from '../core';
import { Icon } from '../icons/Icon';
import type {
  CompareCell,
  CompareSection,
  CtaState,
  PlanSlug,
} from '../../../lib/pricing/planDefinition';
import {
  COMPARE_SECTIONS,
  PRICING_GRID_SLUGS,
  ctaLabel,
  getPlanDefinition,
  planDisplayPrice,
  trackPricingEvent,
} from '../../../lib/pricing/planDefinition';
import type { BillingPeriod } from '../../../lib/billingPlans';
import type { PricingCardAction } from './PricingCard';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { radius } from '../tokens/effects';

export type ComparePricingTableProps = {
  billing: BillingPeriod;
  sections?: CompareSection[];
  resolveCta: (slug: PlanSlug) => CtaState;
  onAction: (action: PricingCardAction) => void;
  className?: string;
};

const Root = styled.section`
  font-family: ${typeface.body};
  width: 100%;
`;

const Title = styled.h2`
  margin: 0 0 ${spacing.md};
  font-size: ${textScale['2xl'].fontSize};
  line-height: ${textScale['2xl'].lineHeight};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  text-align: center;
`;

const Sub = styled.p`
  margin: 0 0 ${spacing['2xl']};
  font-size: ${textScale.base.fontSize};
  color: ${semantic.text.secondary};
  text-align: center;
`;

const Desktop = styled.div`
  display: none;
  @media (min-width: 900px) {
    display: block;
    overflow-x: auto;
  }
`;

const Mobile = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  @media (min-width: 900px) {
    display: none;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
`;

const ThFeature = styled.th`
  position: sticky;
  left: 0;
  z-index: 2;
  background: ${semantic.background.primary};
  text-align: left;
  padding: ${spacing.md};
  width: 28%;
  border-bottom: 1px solid ${semantic.border.primary};
  font-size: ${textScale.sm.fontSize};
  color: ${semantic.text.secondary};
`;

const ThPlan = styled.th`
  text-align: center;
  padding: ${spacing.lg} ${spacing.md};
  border-bottom: 1px solid ${semantic.border.primary};
  vertical-align: top;
  background: ${semantic.background.primary};
`;

const PlanName = styled.div`
  font-size: ${textScale.lg.fontSize};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  margin-bottom: 4px;
`;

const PlanPrice = styled.div`
  font-size: ${textScale.base.fontSize};
  color: ${semantic.text.secondary};
  margin-bottom: ${spacing.md};
`;

const SectionRow = styled.tr`
  th {
    text-align: left;
    padding: ${spacing.lg} ${spacing.md} ${spacing.sm};
    font-size: ${textScale.base.fontSize};
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
    background: ${semantic.background.secondary};
    position: sticky;
    left: 0;
    z-index: 1;
  }
  td {
    background: ${semantic.background.secondary};
    border-bottom: 1px solid ${semantic.border.primary};
  }
`;

const TdFeature = styled.th`
  position: sticky;
  left: 0;
  z-index: 1;
  background: ${semantic.background.primary};
  text-align: left;
  padding: ${spacing.md};
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.secondary};
  border-bottom: 1px solid ${semantic.border.primary};
`;

const TdCell = styled.td`
  text-align: center;
  padding: ${spacing.md};
  border-bottom: 1px solid ${semantic.border.primary};
  font-size: ${textScale.sm.fontSize};
  color: ${semantic.text.primary};
  vertical-align: middle;
`;

const Accordion = styled.div`
  border: 1px solid ${semantic.border.primary};
  border-radius: ${radius.card.default};
  overflow: hidden;
  background: ${semantic.background.primary};
`;

const AccordionHead = styled.button`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.md};
  padding: ${spacing.md} ${spacing.lg};
  border: none;
  background: ${semantic.background.secondary};
  font: inherit;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  cursor: pointer;
  text-align: left;
`;

const AccordionBody = styled.div`
  display: flex;
  flex-direction: column;
`;

const FeatureBlock = styled.div`
  padding: ${spacing.md} ${spacing.lg};
  border-top: 1px solid ${semantic.border.primary};
`;

const FeatureLabel = styled.div`
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  margin-bottom: ${spacing.sm};
`;

const PlanValueRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
  padding: 4px 0;
  font-size: ${textScale.sm.fontSize};
  color: ${semantic.text.secondary};
`;

function CellView({ cell }: { cell: CompareCell }) {
  if (cell.kind === 'check') {
    return <Icon name="Check" size={18} weight="bold" color={semantic.status.success} aria-label="Included" />;
  }
  if (cell.kind === 'dash') {
    return <span aria-label="Not included">—</span>;
  }
  return <span>{cell.value}</span>;
}

/** Feature comparison — desktop table + mobile accordion. */
export function ComparePricingTable({
  billing,
  sections,
  resolveCta,
  onAction,
  className,
}: ComparePricingTableProps) {
  const rows = sections ?? COMPARE_SECTIONS;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((sections ?? COMPARE_SECTIONS).map((s) => [s.id, true])),
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const open = !prev[id];
      trackPricingEvent({ type: 'compare_section_expand', sectionId: id, open });
      return { ...prev, [id]: open };
    });
  };

  const planCols = PRICING_GRID_SLUGS.map((slug) => getPlanDefinition(slug));

  return (
    <Root className={className} aria-labelledby="compare-pricing-heading">
      <Title id="compare-pricing-heading">Compare plans</Title>
      <Sub>Feature-by-feature — pick the tier that matches your workspace.</Sub>

      <Desktop>
        <Table>
          <thead>
            <tr>
              <ThFeature scope="col">Feature</ThFeature>
              {planCols.map((plan) => {
                const ctaState = resolveCta(plan.slug);
                return (
                  <ThPlan key={plan.slug} scope="col">
                    <PlanName>{plan.name}</PlanName>
                    <PlanPrice>
                      €{planDisplayPrice(plan, billing)}/month
                    </PlanPrice>
                    <Button
                      type="button"
                      variant={plan.recommended && ctaState !== 'current' ? 'primary' : 'secondary'}
                      size="sm"
                      disabled={ctaState === 'current'}
                      onClick={() => {
                        trackPricingEvent({
                          type: 'compare_cta_click',
                          slug: plan.slug,
                          ctaState,
                          billing,
                        });
                        onAction({ slug: plan.slug, billing, ctaState });
                      }}
                    >
                      {ctaLabel(ctaState, plan.name)}
                    </Button>
                  </ThPlan>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((section) => (
              <React.Fragment key={section.id}>
                <SectionRow>
                  <th scope="colgroup" colSpan={1}>{section.title}</th>
                  <td colSpan={planCols.length} />
                </SectionRow>
                {section.rows.map((row) => (
                  <tr key={row.id}>
                    <TdFeature scope="row">{row.label}</TdFeature>
                    {PRICING_GRID_SLUGS.map((slug) => (
                      <TdCell key={slug}>
                        <CellView cell={row.cells[slug]} />
                      </TdCell>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
      </Desktop>

      <Mobile>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {planCols.map((plan) => {
            const ctaState = resolveCta(plan.slug);
            return (
              <div key={plan.slug} style={{ textAlign: 'center' }}>
                <PlanName style={{ fontSize: 14 }}>{plan.name}</PlanName>
                <PlanPrice style={{ fontSize: 12 }}>€{planDisplayPrice(plan, billing)}/mo</PlanPrice>
                <Button
                  type="button"
                  variant={plan.recommended && ctaState !== 'current' ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={ctaState === 'current'}
                  style={{ width: '100%' }}
                  onClick={() => onAction({ slug: plan.slug, billing, ctaState })}
                >
                  {ctaLabel(ctaState, plan.name)}
                </Button>
              </div>
            );
          })}
        </div>

        {rows.map((section) => {
          const open = openSections[section.id] !== false;
          return (
            <Accordion key={section.id}>
              <AccordionHead
                type="button"
                aria-expanded={open}
                onClick={() => toggleSection(section.id)}
              >
                {section.title}
                <Icon name={open ? 'CaretUp' : 'CaretDown'} size={16} weight="bold" />
              </AccordionHead>
              {open ? (
                <AccordionBody>
                  {section.rows.map((row) => (
                    <FeatureBlock key={row.id}>
                      <FeatureLabel>{row.label}</FeatureLabel>
                      {PRICING_GRID_SLUGS.map((slug) => (
                        <PlanValueRow key={slug}>
                          <span>{getPlanDefinition(slug).name}</span>
                          <CellView cell={row.cells[slug]} />
                        </PlanValueRow>
                      ))}
                    </FeatureBlock>
                  ))}
                </AccordionBody>
              ) : null}
            </Accordion>
          );
        })}
      </Mobile>
    </Root>
  );
}

export default ComparePricingTable;
